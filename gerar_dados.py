#!/usr/bin/env python3
"""Gera o histórico público a partir dos extratos privados do Nubank."""

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
import re
from tempfile import NamedTemporaryFile


COLUNAS = {"Data", "Valor", "Identificador", "Descrição"}
PIX_DE_TESTE = {
    ("2026-10-19", 1, "transferência recebida pelo pix"),
    ("2026-10-19", -1, "transferência enviada pelo pix"),
}
CATEGORIAS = (
    ("transferência recebida", "Transferência recebida"),
    ("transferência enviada", "Transferência enviada"),
    ("compra no débito", "Compra no débito"),
    ("pagamento", "Pagamento"),
    ("estorno", "Estorno"),
    ("rendimento", "Rendimento"),
)


def classificar(tipo, favorecido, valor, favorecido_quadra, mensalidade_centavos):
    if valor < 0 and favorecido_quadra:
        if re.search(r"\b" + re.escape(favorecido_quadra) + r"\b", favorecido):
            return "Mensalidade da quadra"
        if tipo == "transferência enviada pelo pix":
            return "Goleiros"
    if valor > 0 and valor == mensalidade_centavos and tipo.startswith("transferência recebida"):
        return "Mensalidade do grupo"
    return next((categoria for prefixo, categoria in CATEGORIAS if tipo.startswith(prefixo)), None)


def abreviar_pagador(contraparte):
    nome = re.sub(r"^[0-9]{2}\.[0-9]{3}\.[0-9]{3}\s+", "", contraparte)
    partes = nome.split()
    if len(partes) < 2 or not all(parte.isalpha() for parte in partes):
        return None
    return f"{partes[0].title()} {partes[-1][0].upper()}."


def ler_extrato(caminho, identificadores, favorecido_quadra, mensalidade_centavos):
    with caminho.open(encoding="utf-8-sig", newline="") as arquivo:
        leitor = csv.DictReader(arquivo, strict=True)
        if not COLUNAS.issubset(leitor.fieldnames or ()):
            raise ValueError("Cabeçalho diferente do formato Nubank esperado.")
        for linha in leitor:
            numero = leitor.line_num
            if None in linha or any(linha[coluna] is None for coluna in COLUNAS):
                raise ValueError(f"Linha {numero}: quantidade de colunas inválida.")
            try:
                data = datetime.strptime(linha["Data"].strip(), "%d/%m/%Y").date()
            except ValueError:
                raise ValueError(f"Linha {numero}: data inválida.") from None
            valor = linha["Valor"].strip()
            if not re.fullmatch(r"-?[0-9]+\.[0-9]{2}", valor):
                raise ValueError(f"Linha {numero}: valor inválido.")
            identificador = linha["Identificador"].strip()
            if not identificador or identificador in identificadores:
                raise ValueError(f"Linha {numero}: identificador ausente ou repetido. Confira os extratos.")
            identificadores.add(identificador)

            centavos = int(valor.replace(".", ""))
            data_iso = data.isoformat()
            descricao = linha["Descrição"].strip()
            tipo, _, detalhes = descricao.partition(" - ")
            tipo = tipo.casefold()
            contraparte = detalhes.partition(" - ")[0].strip()
            if (data_iso, centavos, tipo) in PIX_DE_TESTE:
                continue

            registro = {"data": data_iso, "valor_centavos": centavos}
            categoria = classificar(tipo, contraparte.casefold(), centavos, favorecido_quadra, mensalidade_centavos)
            if categoria:
                registro["categoria"] = categoria
            if centavos > 0 and tipo.startswith("transferência recebida"):
                pagador = abreviar_pagador(contraparte)
                if pagador:
                    registro["pagador"] = pagador
            yield registro


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", nargs="+", type=Path, help="Extratos Nubank em CSV")
    parser.add_argument("--favorecido-quadra", default="", help="Nome do clube no extrato")
    parser.add_argument("--mensalidade-centavos", type=int, help="Valor de uma mensalidade do grupo")
    args = parser.parse_args()
    destino = Path(__file__).resolve().with_name("data.json")
    registros = []
    identificadores = set()

    for indice, caminho in enumerate(args.csv, start=1):
        try:
            registros.extend(ler_extrato(
                caminho, identificadores, args.favorecido_quadra.strip().casefold(), args.mensalidade_centavos,
            ))
        except (UnicodeError, OSError, csv.Error):
            parser.exit(1, f"CSV {indice}: falha ao ler o arquivo no formato esperado.\n")
        except ValueError as erro:
            parser.exit(1, f"CSV {indice}: {erro}\n")

    registros.sort(key=lambda registro: registro["data"], reverse=True)
    with NamedTemporaryFile(dir=destino.parent, mode="w", encoding="utf-8", delete=False) as arquivo:
        temporario = Path(arquivo.name)
        try:
            json.dump(registros, arquivo, ensure_ascii=False, indent=2)
            arquivo.write("\n")
            arquivo.close()
            temporario.replace(destino)
        finally:
            temporario.unlink(missing_ok=True)

    print(f"data.json gerado com {len(registros)} movimentações.")


if __name__ == "__main__":
    main()
