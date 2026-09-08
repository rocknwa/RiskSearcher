"""The Graph gateway client for Uniswap V3 Ethereum liquidity evidence."""

from __future__ import annotations

import os
import time

import requests

UNISWAP_V3_MAINNET_SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"
GATEWAY_URL = "https://gateway.thegraph.com/api/{api_key}/subgraphs/id/{subgraph_id}"

TOKEN_LIQUIDITY_QUERY = """
query TokenLiquidity($token: String!, $since7d: Int!) {
  token(id: $token) {
    id
    totalValueLockedUSD
    poolCount
  }
  token0Pools: pools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token0: $token}) {
    id
    swaps(first: 1, orderBy: timestamp, orderDirection: asc) {
      timestamp
    }
    poolDayData(first: 7, orderBy: date, orderDirection: desc, where: {date_gte: $since7d}) {
      date
      volumeUSD
    }
  }
  token1Pools: pools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token1: $token}) {
    id
    swaps(first: 1, orderBy: timestamp, orderDirection: asc) {
      timestamp
    }
    poolDayData(first: 7, orderBy: date, orderDirection: desc, where: {date_gte: $since7d}) {
      date
      volumeUSD
    }
  }
}
"""

# Cursor-paginated, ID-only (no nested data, cheap) — used to count pools
# past GraphQL's 1000-per-request `first` ceiling for hub tokens (WETH,
# USDC, USDT, WBTC) that can have several thousand real Uniswap V3 pools.
POOL_ID_PAGE_QUERY = """
query PoolIdsBySide($token: String!, $cursor: String!) {
  pools(first: 1000, orderBy: id, orderDirection: asc, where: {%s: $token, id_gt: $cursor}) {
    id
  }
}
"""

# Hard ceiling on pagination rounds per side. 5 pages x 1000 = 5000 pools
# per side (10,000 total across both sides) comfortably covers even WETH's
# researched ~3,500 active V3 pools with headroom, while still bounding
# worst-case request count/latency for a single scan.
MAX_POOL_ID_PAGES = 5


def _no_data(token_address: str, chain: str, reason: str) -> dict:
    """Return the stable, explicitly degraded Graph-evidence shape."""
    return {
        "source": "the_graph_uniswap_v3",
        "token_address": token_address,
        "chain": chain,
        "no_data": True,
        "reason": reason,
        "total_liquidity_usd": None,
        "first_swap_timestamp": None,
        "recent_swap_volume_usd": {"24h": None, "7d": None},
        "pool_count": 0,
        "pool_count_exact": True,
    }


def _as_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _paginate_pool_ids(api_key: str, token: str, side_field: str, timeout: int) -> tuple[set, bool]:
    """Cursor-paginate pool IDs for one side (token0 or token1) past
    GraphQL's 1000-per-request `first` ceiling.

    Only fires extra requests when a page actually comes back full (1000
    IDs) - for the overwhelming majority of tokens (under 1000 pools per
    side) this is a single cheap ID-only request, same cost as before.
    Only true hub tokens (WETH, USDC, USDT, WBTC) pay for pagination.

    Returns (ids, is_exact). is_exact is False if MAX_POOL_ID_PAGES was
    exhausted without a short final page (there are likely more pools
    beyond what was fetched) or a page request failed outright - callers
    should treat the count as a lower bound, not a final number, in
    either case.
    """
    query = POOL_ID_PAGE_QUERY % side_field
    ids: set = set()
    cursor = ""
    for page_num in range(MAX_POOL_ID_PAGES):
        try:
            response = requests.post(
                GATEWAY_URL.format(api_key=api_key, subgraph_id=UNISWAP_V3_MAINNET_SUBGRAPH_ID),
                json={"query": query, "variables": {"token": token, "cursor": cursor}},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            print(f"    [GRAPH] Pool-ID pagination request failed ({side_field}, page {page_num + 1}) after {len(ids)} id(s) so far: {exc}")
            return ids, False
        if payload.get("errors"):
            print(f"    [GRAPH] Pool-ID pagination query error ({side_field}, page {page_num + 1}): {payload['errors']}")
            return ids, False

        page = (payload.get("data") or {}).get("pools") or []
        if not page:
            return ids, True
        for pool in page:
            pid = pool.get("id")
            if pid:
                ids.add(pid)
        if len(page) < 1000:
            return ids, True
        cursor = page[-1]["id"]

    # Exhausted MAX_POOL_ID_PAGES pages and the last one was still full -
    # there are almost certainly more pools than MAX_POOL_ID_PAGES*1000.
    print(f"    [GRAPH] Pool-ID pagination hit the {MAX_POOL_ID_PAGES}-page cap for {side_field} ({len(ids)} id(s) so far); treating count as a lower bound")
    return ids, False


def get_token_liquidity_data(token_address: str, chain: str) -> dict:
    """Fetch live Uniswap V3 Ethereum liquidity and swap-volume evidence.

    The configured Uniswap V3 subgraph is Ethereum mainnet-only. Missing API
    keys, unsupported chains, empty token records, and Gateway errors all
    return a clearly marked ``no_data`` result so analysis can continue.
    """
    chain_name = (chain or "ethereum").strip().lower()
    if chain_name not in {"ethereum", "eth", "mainnet"}:
        print(f"    [GRAPH] Skipping {chain_name}: Uniswap V3 subgraph is Ethereum mainnet-only")
        return _no_data(token_address, chain_name, "unsupported_chain")

    api_key = os.environ.get("GRAPH_API_KEY", "").strip()
    if not api_key:
        print("    [GRAPH] GRAPH_API_KEY not set; skipping liquidity evidence")
        return _no_data(token_address, chain_name, "missing_api_key")

    normalized_address = token_address.lower()
    now = int(time.time())
    try:
        response = requests.post(
            GATEWAY_URL.format(api_key=api_key, subgraph_id=UNISWAP_V3_MAINNET_SUBGRAPH_ID),
            json={"query": TOKEN_LIQUIDITY_QUERY, "variables": {"token": normalized_address, "since7d": now - 7 * 86400}},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errors"):
            print(f"    [GRAPH] Query failed for {token_address}: {payload['errors']}")
            return _no_data(token_address, chain_name, "query_error")

        data = payload.get("data") or {}
        token = data.get("token")
        if not token:
            print(f"    [GRAPH] No Uniswap V3 token data for {token_address}")
            return _no_data(token_address, chain_name, "token_not_found")

        token0_pools = data.get("token0Pools") or []
        token1_pools = data.get("token1Pools") or []
        pools_by_id = {
            pool.get("id"): pool
            for pool in token0_pools + token1_pools
            if pool.get("id")
        }
        # `pools` (above) is the capped, TVL-ordered, nested-data set used
        # only for the volume/age approximation below - it maxes out at 100
        # regardless of how many pools actually exist (see the query's cap).
        # For the *count* itself, paginate the ID-only side separately -
        # cursor-paginated past GraphQL's 1000-per-request ceiling, since
        # hub tokens (WETH, USDC, USDT, WBTC) can have several thousand
        # real pools. Using the capped nested-data list here would silently
        # report a number far below reality, which is exactly the bug this
        # fixes (first as a flat 100-pool cap, then again at a flat 1000
        # when a single-page ID query was tried instead).
        pools = list(pools_by_id.values())
        token0_ids, token0_exact = _paginate_pool_ids(api_key, normalized_address, "token0", timeout=15)
        token1_ids, token1_exact = _paginate_pool_ids(api_key, normalized_address, "token1", timeout=15)
        all_pool_ids = token0_ids | token1_ids
        real_pool_count = len(all_pool_ids)
        pool_count_exact = token0_exact and token1_exact
        token_pool_count = int(token.get("poolCount") or 0)

        # Diagnostic: token.poolCount and the ID-only enumeration are two
        # independent reads of the same thing and should agree exactly when
        # pool_count_exact is True (pagination wasn't cut short). When
        # pagination WAS cut short, a mismatch is expected (real_pool_count
        # is a floor, not the true value) and not worth flagging.
        if pool_count_exact and token_pool_count != real_pool_count:
            print(
                f"    [GRAPH][DIAGNOSTIC] Mismatch for {normalized_address}: "
                f"token.poolCount={token_pool_count} but ID-only enumeration found "
                f"{real_pool_count} pool(s). This is not yet root-caused against the "
                "live Gateway - treat pool_count below as unverified if this line appears."
            )


        first_swaps = [int(swap["timestamp"]) for pool in pools for swap in (pool.get("swaps") or []) if swap.get("timestamp")]
        # Note: for tokens with more than 100 real pools, `pools` only holds
        # the top ~100 by TVL (see the query's per-side cap above), not every
        # pool. That means first_swap_timestamp / volume figures below are an
        # approximation over the highest-liquidity pools, not a full-population
        # figure - they can slightly understate 24h/7d volume from long-tail
        # low-liquidity pools, and could show a younger age than reality if the
        # token's original/oldest pool has since gone quiet and dropped out of
        # the top-100. This trade-off is intentional: fetching every pool for
        # a token like DAI (500+ pools, each with nested swap+day data) was
        # timing out the Gateway request outright, so an approximation over
        # the pools that actually carry most of the volume beats no data at all.
        volume_24h = 0.0
        volume_7d = 0.0
        for pool in pools:
            for day in pool.get("poolDayData") or []:
                volume = _as_float(day.get("volumeUSD"))
                day_timestamp = int(day.get("date") or 0)
                if day_timestamp >= now - 7 * 86400:
                    volume_7d += volume
                if day_timestamp >= now - 86400:
                    volume_24h += volume

        total_liquidity_usd = _as_float(token.get("totalValueLockedUSD"))
        # A pool count of zero next to real, nonzero TVL is internally
        # contradictory - a token can't have liquidity locked in zero pools.
        # Rather than hand the specialist/report a confident-looking "0 pools"
        # that isn't actually trustworthy, mark those specific sub-fields as
        # unavailable so they aren't reasoned over as if verified.
        pools_data_reliable = not (total_liquidity_usd > 0 and real_pool_count == 0 and token_pool_count == 0)

        result = {
            "source": "the_graph_uniswap_v3",
            "token_address": normalized_address,
            "chain": "ethereum",
            "no_data": False,
            "reason": "" if pools_data_reliable else "pool_level_data_unavailable",
            "total_liquidity_usd": total_liquidity_usd,
            "first_swap_timestamp": min(first_swaps) if first_swaps and pools_data_reliable else None,
            "recent_swap_volume_usd": (
                {"24h": volume_24h, "7d": volume_7d}
                if pools_data_reliable
                else {"24h": None, "7d": None}
            ),
            "pool_count": max(token_pool_count, real_pool_count),
            # False for hub tokens (WETH, USDC, USDT, WBTC, ...) whose true
            # pool count exceeds MAX_POOL_ID_PAGES*1000 per side - pool_count
            # above is then a floor, not the true value, and should be
            # rendered as e.g. "5,000+" rather than an exact-looking number.
            "pool_count_exact": pool_count_exact,
            "pools_data_reliable": pools_data_reliable,
        }
        print(
            f"    [GRAPH] Fetched Uniswap V3 liquidity evidence: {result['pool_count']}"
            f"{'' if pool_count_exact else '+'} pool(s), "
            f"${result['total_liquidity_usd']:,.2f} TVL"
            + ("" if pools_data_reliable else " (pool-level detail unavailable this run - see diagnostic above)")
        )
        return result
    except Exception as exc:
        print(f"    [GRAPH] Query failed for {token_address}: {exc}")
        return _no_data(token_address, chain_name, "request_failed")
