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
    }


def _as_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


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
        pools = list(pools_by_id.values())
        token_pool_count = int(token.get("poolCount") or 0)

        # Diagnostic: the pools(where: {token0/token1: $token}) sub-queries are
        # capped at 50-per-side (ordered by TVL desc) to keep the query fast
        # for high-liquidity tokens with hundreds of real pools (a token with
        # >100 pools legitimately returning fewer than token.poolCount here is
        # expected sampling, not a bug). Only flag a genuine anomaly: the
        # token claims fewer pools than we actually fetched, or it claims
        # pools exist but the sub-queries found none, or it's under the cap
        # yet still doesn't match what we fetched.
        POOL_FETCH_CAP = 100  # 50 per side (token0 + token1)
        if token_pool_count == 0 and len(pools) > 0:
            print(
                f"    [GRAPH][DIAGNOSTIC] Mismatch for {normalized_address}: "
                f"token.poolCount=0 but {len(pools)} pool(s) were found. "
                "This is not yet root-caused against the live Gateway - treat "
                "pool_count/volume/age below as unverified if this line appears."
            )
        elif 0 < token_pool_count < len(pools):
            print(
                f"    [GRAPH][DIAGNOSTIC] Mismatch for {normalized_address}: "
                f"token.poolCount={token_pool_count} but {len(pools)} pool(s) were found. "
                "This is not yet root-caused against the live Gateway - treat "
                "pool_count/volume/age below as unverified if this line appears."
            )
        elif 0 < token_pool_count <= POOL_FETCH_CAP and token_pool_count != len(pools):
            print(
                f"    [GRAPH][DIAGNOSTIC] Mismatch for {normalized_address}: "
                f"token.poolCount={token_pool_count}, token0Pools={len(token0_pools)}, "
                f"token1Pools={len(token1_pools)}, merged pools={len(pools)}. "
                "This is not yet root-caused against the live Gateway - treat "
                "pool_count/volume/age below as unverified if this line appears."
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
        pools_data_reliable = not (total_liquidity_usd > 0 and len(pools) == 0 and token_pool_count == 0)

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
            "pool_count": max(token_pool_count, len(pools)),
            "pools_data_reliable": pools_data_reliable,
        }
        print(
            f"    [GRAPH] Fetched Uniswap V3 liquidity evidence: {result['pool_count']} pool(s), "
            f"${result['total_liquidity_usd']:,.2f} TVL"
            + ("" if pools_data_reliable else " (pool-level detail unavailable this run - see diagnostic above)")
        )
        return result
    except Exception as exc:
        print(f"    [GRAPH] Query failed for {token_address}: {exc}")
        return _no_data(token_address, chain_name, "request_failed")
