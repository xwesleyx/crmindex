"""
Ponto de entrada do whatsapp-service empacotado (PyInstaller) pro
instalador Windows. Faz o mesmo que `uvicorn main:app`, mas como um .exe
único — sem precisar de Python instalado na máquina. Toda a configuração
(segredo, URLs, pasta de sessão/mídia) chega por variável de ambiente,
passada pelo launcher do Integra CRM.
"""

import os

import uvicorn

import main  # whatsapp-service/main.py (incluído no build pelo --paths)


if __name__ == "__main__":
    uvicorn.run(
        main.app,
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8787")),
        log_level="info",
    )
