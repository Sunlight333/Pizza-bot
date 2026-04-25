"""
Datacaixa .txt format — verify pipe delimiters, comma decimals, UTF-8,
SEFAZ payment codes (01/03/04/17/90), and the PEDIDO / ITEM / PGTO
line structure per Gabriel's spec.
"""
from app.services.datacaixa import _brl, _clean


def validate_content(content: str) -> list[str]:
    """Inlined validator (mirrors bridge/txt_writer.validate_content)."""
    issues: list[str] = []
    lines = [ln for ln in content.splitlines() if ln.strip()]
    if not lines:
        return ["empty content"]
    if not lines[0].startswith("PEDIDO|"):
        issues.append("must start with PEDIDO| line")
    if not lines[-1].startswith("PGTO|"):
        issues.append("must end with PGTO| line")
    item_lines = [ln for ln in lines if ln.startswith("ITEM|")]
    if not item_lines:
        issues.append("no ITEM lines")
    for ln in item_lines:
        parts = ln.split("|")
        if len(parts) < 14:
            issues.append(f"ITEM line has only {len(parts)} fields: {ln[:80]}")
    for ln in lines:
        if "." in ln and "," not in ln:
            for token in ln.split("|"):
                if token.replace(".", "").replace("-", "").isdigit() and "." in token:
                    issues.append(f"decimal with dot instead of comma: {token}")
                    break
    return issues


def test_brl_uses_comma():
    assert _brl(49.90) == "49,90"
    assert _brl(0) == "0,00"
    assert _brl(1234.5) == "1234,50"


def test_clean_strips_pipes_and_newlines():
    assert _clean("Rua com | pipe") == "Rua com / pipe"
    assert _clean("linha1\nlinha2") == "linha1 linha2"
    assert _clean(None) == ""


def _sample_content() -> str:
    return (
        "PEDIDO|Joao da Silva|12345678900||Rua A, 123 / Centro / 5511999999999|\n"
        "ITEM|P001|Pizza Grande Calabresa|52,90|1|UN|19059090|52,90|"
        "1706400|5102||102|0|19059090|\n"
        "ITEM|TAXA|Taxa de Entrega|8,00|1|UN|00000000|8,00|"
        "|5949||102|0||\n"
        "PGTO|17|60,90|\n"
    )


def test_sample_content_validates():
    issues = validate_content(_sample_content())
    assert issues == [], f"unexpected issues: {issues}"


def test_missing_pedido_flagged():
    bad = "ITEM|1|x|1,00|1|UN|NCM|1,00|CEST|CFOP|IBPT|CSOSN|0||\nPGTO|17|1,00|\n"
    issues = validate_content(bad)
    assert any("PEDIDO" in i for i in issues)


def test_item_line_column_count():
    bad = "PEDIDO|A|||obs|\nITEM|1|too|few|fields|\nPGTO|17|1,00|\n"
    issues = validate_content(bad)
    assert any("ITEM line has only" in i for i in issues)


def test_dot_decimal_flagged():
    bad = (
        "PEDIDO|A|||obs|\n"
        "ITEM|1|x|1.00|1|UN|NCM|1.00|CEST|CFOP|IBPT|CSOSN|0|ibpt|\n"
        "PGTO|17|1.00|\n"
    )
    issues = validate_content(bad)
    assert any("decimal with dot" in i for i in issues)


def test_sefaz_payment_codes():
    from app.models.order import PAYMENT_CODE_MAP, PaymentMethod
    assert PAYMENT_CODE_MAP[PaymentMethod.cash] == "01"
    assert PAYMENT_CODE_MAP[PaymentMethod.credit] == "03"
    assert PAYMENT_CODE_MAP[PaymentMethod.debit] == "04"
    assert PAYMENT_CODE_MAP[PaymentMethod.pix] == "17"
    assert PAYMENT_CODE_MAP[PaymentMethod.pickup] == "90"
