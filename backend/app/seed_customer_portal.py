"""
Seed + dev-login helper for the customer portal.

Two purposes:

1. Idempotently seed a small set of demo CustomerAccount + Customer rows
   with realistic profiles and saved addresses, so operators can demo
   the portal without having to register.

2. Print a session JWT for any customer phone so the operator can paste
   it as the `pz_session` cookie and skip the WhatsApp OTP roundtrip
   when testing UI changes.

Run inside the backend container:
    # 1. Seed (idempotent — safe to re-run; updates in place)
    docker compose -f docker-compose.prod.yml exec backend \\
        python -m app.seed_customer_portal seed

    # 2. Print a session token for any phone (digits only, with country code)
    docker compose -f docker-compose.prod.yml exec backend \\
        python -m app.seed_customer_portal token 5517991289777

    # 3. Send a real WhatsApp OTP to any phone (skips rate-limit)
    docker compose -f docker-compose.prod.yml exec backend \\
        python -m app.seed_customer_portal send-otp 5517991289777

To use a printed token in the browser:
    1. Open https://planaltopizzasesorvetes.com/pedir/menu
    2. DevTools → Application → Cookies → planaltopizzasesorvetes.com
    3. Add a cookie:  Name=pz_session, Value=<paste>, Path=/,
       HttpOnly=true, Secure=true, SameSite=Lax
    4. Refresh — you're logged in as that customer.

Production safety: this module never auto-runs. Both `token` and
`send-otp` require shell access to the backend container, which is
already root-equivalent in this environment, so they don't expose any
new attack surface.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.database import AsyncSessionLocal
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services import otp as otp_service
from app.utils.customer_security import create_customer_token


# --- Demo accounts -------------------------------------------------------
# Each entry is one customer the operator can demo with. Phones use the
# 5517 area code (matches the pizzaria's own region — São José do Rio
# Preto). The "dev" 0000-0001..0004 numbers are unlikely to collide with
# any real customer, so seeding is safe in prod.
DEMO_ACCOUNTS = [
    {
        "phone": "5517900000001",
        "name": "Cliente Teste",
        "email": None,
        "marketing_opt_in": True,
        "addresses": [
            {
                "label": "Casa",
                "cep": "15015-110",
                "street": "Rua Bernardino de Campos",
                "number": "100",
                "neighborhood": "Centro",
                "complement": "apto 4",
                "reference": "Esquina com Marechal",
            },
        ],
    },
    {
        "phone": "5517900000002",
        "name": "Maria do Bairro",
        "email": "maria.demo@example.com",
        "marketing_opt_in": True,
        "addresses": [
            {
                "label": "Casa",
                "cep": "15025-000",
                "street": "Rua Independência",
                "number": "456",
                "neighborhood": "Vila Imperial",
                "complement": None,
                "reference": "Casa azul, portão de madeira",
            },
            {
                "label": "Trabalho",
                "cep": "15015-110",
                "street": "Rua General Glicério",
                "number": "1234",
                "neighborhood": "Centro",
                "complement": "10º andar",
                "reference": "Edifício Cores",
            },
        ],
    },
    {
        "phone": "5517900000003",
        "name": "João da Pizza",
        "email": None,
        "marketing_opt_in": False,
        "addresses": [
            {
                "label": "Casa",
                "cep": "15043-040",
                "street": "Rua Florianópolis",
                "number": "789",
                "neighborhood": "Boa Vista",
                "complement": None,
                "reference": None,
            },
        ],
    },
    {
        "phone": "5517900000004",
        "name": "Fresh — Sem Pedidos",
        "email": None,
        "marketing_opt_in": False,
        # No saved addresses — useful for testing the "no address yet"
        # checkout path.
        "addresses": [],
    },
]


# --- Seed ----------------------------------------------------------------

async def _seed() -> None:
    async with AsyncSessionLocal() as db:
        for entry in DEMO_ACCOUNTS:
            phone = entry["phone"]
            customer = (
                await db.execute(select(Customer).where(Customer.phone == phone))
            ).scalar_one_or_none()
            if customer is None:
                customer = Customer(phone=phone)
                db.add(customer)
                await db.flush()
                created_customer = True
            else:
                created_customer = False

            customer.name = entry["name"]
            # Replace addresses wholesale — keeps the seed deterministic.
            customer.addresses = list(entry["addresses"])
            flag_modified(customer, "addresses")
            customer.default_address_index = 0 if entry["addresses"] else 0

            account = (
                await db.execute(
                    select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
                )
            ).scalar_one_or_none()
            if account is None:
                account = CustomerAccount(
                    customer_id=customer.id,
                    email=entry["email"],
                    marketing_opt_in=entry["marketing_opt_in"],
                    last_login_at=datetime.now(timezone.utc),
                )
                db.add(account)
                created_account = True
            else:
                account.email = entry["email"]
                account.marketing_opt_in = entry["marketing_opt_in"]
                created_account = False

            await db.commit()

            tag = (
                "+" if (created_customer and created_account)
                else "~"
            )
            print(
                f"{tag} {entry['name']:24} {phone}  "
                f"addresses={len(entry['addresses'])}  "
                f"opt_in={entry['marketing_opt_in']}"
            )

    print("\ncustomer-portal seed complete\n")
    print("Sign in to the portal with one of these phones.\n")
    print("Two options to log in:")
    print("  a) Use the normal flow at /pedir/login — but the OTP goes")
    print("     to the demo phone (which doesn't exist), so use option b.")
    print("  b) Print a session token here and paste it into your browser:")
    print("       python -m app.seed_customer_portal token 5517900000001\n")


# --- Print session token -------------------------------------------------

async def _print_token(phone: str) -> int:
    digits = otp_service.normalize_phone(phone)
    if not digits:
        print(f"!! invalid phone: {phone!r}", file=sys.stderr)
        return 2
    async with AsyncSessionLocal() as db:
        customer = (
            await db.execute(select(Customer).where(Customer.phone == digits))
        ).scalar_one_or_none()
        if customer is None:
            print(f"!! no customer with phone {digits} — run `seed` first", file=sys.stderr)
            return 2
        # Make sure a CustomerAccount exists; create one on demand so the
        # token is actually useful (login requires the account row).
        account = (
            await db.execute(
                select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
            )
        ).scalar_one_or_none()
        if account is None:
            account = CustomerAccount(customer_id=customer.id)
            db.add(account)
            await db.commit()
            await db.refresh(account)

    token = create_customer_token(customer.id)
    print(f"# customer: {customer.name or '(no name)'}  phone: {customer.phone}")
    print(f"# customer_id: {customer.id}")
    print(f"# token (paste as cookie pz_session, valid 30 days):\n")
    print(token)
    print(
        "\n# To use in browser:"
        "\n#   DevTools → Application → Cookies → planaltopizzasesorvetes.com"
        "\n#   Name=pz_session, Value=<paste above>, Path=/, HttpOnly, Secure,"
        "\n#   SameSite=Lax"
    )
    return 0


# --- Send a real WhatsApp OTP to any phone ------------------------------

async def _send_otp(phone: str) -> int:
    digits = otp_service.normalize_phone(phone)
    if not digits:
        print(f"!! invalid phone: {phone!r}", file=sys.stderr)
        return 2
    print(f"sending OTP to {digits} via WhatsApp...")
    try:
        await otp_service.generate_and_send(digits)
    except Exception as e:
        print(f"!! send failed: {e}", file=sys.stderr)
        return 1
    print("OK — check WhatsApp on that number for the 6-digit code.")
    return 0


# --- entry point ---------------------------------------------------------

USAGE = """\
usage:
  python -m app.seed_customer_portal seed
  python -m app.seed_customer_portal token <phone-with-country-code>
  python -m app.seed_customer_portal send-otp <phone-with-country-code>
"""


async def _main(argv: list[str]) -> int:
    if not argv:
        print(USAGE, file=sys.stderr)
        return 2
    cmd = argv[0]
    if cmd == "seed":
        await _seed()
        return 0
    if cmd == "token":
        if len(argv) < 2:
            print(USAGE, file=sys.stderr); return 2
        return await _print_token(argv[1])
    if cmd == "send-otp":
        if len(argv) < 2:
            print(USAGE, file=sys.stderr); return 2
        return await _send_otp(argv[1])
    print(USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main(sys.argv[1:])))
