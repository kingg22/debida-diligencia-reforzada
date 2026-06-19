"""Genera una clave Fernet URL-safe base64 para cifrar los secrets 2FA.

Uso::

    python scripts/generate-fernet-key.py

Copia la salida a la variable ``FERNET_KEY`` en tu ``.env``. **Si rotas la
clave, los secrets 2FA existentes dejarán de ser descifrables** y los
usuarios tendrán que re-enrolar.
"""

from __future__ import annotations

from cryptography.fernet import Fernet


def main() -> None:
    print(Fernet.generate_key().decode())


if __name__ == "__main__":
    main()
