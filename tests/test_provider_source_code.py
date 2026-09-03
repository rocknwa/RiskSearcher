import json

from rpc import provider


class _DummyResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_get_source_code_handles_wrapped_json_string(monkeypatch):
    source_blob = json.dumps({
        "language": "Solidity",
        "sources": {
            "contracts/eth/Token.sol": {
                "content": "pragma solidity ^0.8.22; contract Token { function transfer(address to, uint256 amount) public returns (bool) { return true; } }"
            }
        },
        "settings": {"optimizer": {"enabled": True}}
    })
    payload = {
        "status": "1",
        "message": "OK",
        "result": [{
            "SourceCode": json.dumps(source_blob),
            "ABI": "[]",
            "ContractName": "Token",
            "CompilerVersion": "v0.8.22+commit.4f2d3",
            "LicenseType": "MIT",
            "Implementation": "",
        }],
    }

    def fake_get(url, params=None, timeout=None):
        return _DummyResponse(payload)

    monkeypatch.setattr(provider.requests, "get", fake_get)

    result = provider.get_source_code("0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571")

    assert result["verified"] is True
    assert "contract Token" in result["source_code"]
    assert "function transfer" in result["source_code"]
    assert result["contract_name"] == "Token"


def test_get_source_code_handles_plain_string_source(monkeypatch):
    payload = {
        "status": "1",
        "message": "OK",
        "result": [{
            "SourceCode": "pragma solidity ^0.8.22; contract Token { function transfer(address to, uint256 amount) public { } }",
            "ABI": "[]",
            "ContractName": "Token",
            "CompilerVersion": "v0.8.22+commit.4f2d3",
            "LicenseType": "MIT",
            "Implementation": "",
        }],
    }

    def fake_get(url, params=None, timeout=None):
        return _DummyResponse(payload)

    monkeypatch.setattr(provider.requests, "get", fake_get)

    result = provider.get_source_code("0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571")

    assert result["verified"] is True
    assert "pragma solidity" in result["source_code"]
    assert "function transfer" in result["source_code"]


def test_get_source_code_handles_extra_brace_wrapper(monkeypatch):
    source_blob = json.dumps({
        "language": "Solidity",
        "sources": {
            "contracts/eth/Token.sol": {
                "content": "contract Token { function transfer(address to, uint256 amount) public returns (bool) { return true; } }"
            }
        }
    })
    payload = {
        "status": "1",
        "message": "OK",
        "result": [{
            "SourceCode": "{" + source_blob + "}",
            "ABI": "[]",
            "ContractName": "Token",
            "CompilerVersion": "v0.8.22+commit.4f2d3",
            "LicenseType": "MIT",
            "Implementation": "",
        }],
    }

    monkeypatch.setattr(provider.requests, "get", lambda *args, **kwargs: _DummyResponse(payload))

    result = provider.get_source_code("0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571")

    assert result["sources"]["contracts/eth/Token.sol"]["content"].startswith("contract Token")
