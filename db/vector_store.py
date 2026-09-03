"""
db/vector_store.py — FAISS-backed retrieval of known scam patterns.

On first run, seeds with common scam pattern descriptions.
On subsequent runs, loads from disk. You can add local pattern notes
for future similarity matching without altering the scoring pipeline.
"""

import os
import json
import numpy as np

# Lazy imports — only load heavy deps when needed
_faiss = None
_model = None
_index = None
_patterns = []

DB_PATH = os.path.join(os.path.dirname(__file__), "patterns.json")
INDEX_PATH = os.path.join(os.path.dirname(__file__), "faiss.index")

SEED_PATTERNS = [
    "contract with recoverFunds and blacklist allowing admin to drain and block user transfers",
    "ERC20 token with unrestricted mint function controlled by owner enabling supply inflation",
    "honeypot contract where buy transactions succeed but sell transactions always revert",
    "proxy contract with upgradeability admin key allowing silent logic replacement",
    "rug pull token with openTrading gate and max transaction limits controlled by deployer",
    "fake USDT or stablecoin with hidden mint and transfer pause controlled by single key",
    "contract with SELFDESTRUCT allowing deployer to destroy and drain all ETH",
    "phishing approval contract that requests unlimited token approvals then drains wallet",
    "two-contract drainer architecture where approval contract triggers drain contract",
    "token with transfer tax manipulation where tax is dynamically raised to 99 percent blocking sells",
    "admin rescue function disguised as emergency recovery allowing owner to take all tokens",
    "contract with setBlacklist targeting specific addresses to freeze their funds",
    "fake raffle or lottery contract collecting ETH with no actual prize distribution logic",
    "typosquat token impersonating USDC USDT or WETH with identical name but malicious transfer",
    "contract that mints to deployer address at deployment then immediately dumps on liquidity pool",
]


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        # ~50MB ONNX model — no GPU, no torch required
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _model


def _get_faiss():
    global _faiss
    if _faiss is None:
        import faiss
        _faiss = faiss
    return _faiss


def _embed(texts: list[str]):
    import numpy as np
    model = _get_model()
    return np.array(list(model.embed(texts)), dtype="float32")


SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.75"))


def _build_index(patterns: list[str]):
    faiss = _get_faiss()
    embeddings = _embed(patterns)
    # Normalize embeddings for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    embeddings = embeddings / norms
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    return index


def _load_or_build():
    global _index, _patterns
    if _index is not None:
        return

    # Load custom patterns if saved. If the file is missing or invalid, re-seed it.
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH) as f:
                _patterns = json.load(f)
            if not isinstance(_patterns, list):
                raise ValueError("patterns.json must contain a JSON array")
        except Exception:
            _patterns = list(SEED_PATTERNS)
            with open(DB_PATH, "w") as f:
                json.dump(_patterns, f, indent=2)
    else:
        _patterns = list(SEED_PATTERNS)
        with open(DB_PATH, "w") as f:
            json.dump(_patterns, f, indent=2)

    _index = _build_index(_patterns)


def retrieve_similar(description: str, top_k: int = 3) -> list[dict]:
    """
    Given a description of the contract's behavior, return top_k
    similar known scam patterns with similarity scores.
    """
    try:
        _load_or_build()
        query_vec = _embed([description])
        # Normalize query for cosine
        qnorm = np.linalg.norm(query_vec, axis=1, keepdims=True)
        qnorm[qnorm == 0] = 1.0
        query_vec = query_vec / qnorm
        scores, indices = _index.search(query_vec, top_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(_patterns):
                similarity = float(score)  # inner product on unit vectors == cosine
                if similarity >= SIMILARITY_THRESHOLD:
                    results.append({
                        "pattern": _patterns[idx],
                        "similarity": round(similarity, 3),
                    })
        return results
    except Exception as e:
        return []


def add_pattern(description: str):
    """Add a confirmed scam pattern to the DB for future retrievals."""
    # Instead of mutating the FAISS corpus used for similarity matches,
    # write verdicts and free-form descriptions to a separate audit log.
    # This prevents feedback-loop contamination of the similarity index.
    audit_path = os.path.join(os.path.dirname(__file__), "patterns_audit.log")
    try:
        with open(audit_path, "a", encoding="utf-8") as f:
            f.write(description.replace("\n", " ") + "\n")
    except Exception:
        # Best-effort logging; do not raise here to avoid breaking analysis flow
        pass
