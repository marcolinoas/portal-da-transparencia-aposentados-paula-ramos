# Caixa do futebol

Prestação de contas mensal do grupo. O resultado do período é a diferença entre entradas e saídas. O extrato de outubro de 2026 só traz movimentações, então a página omite o saldo bancário.

## Gerar e atualizar o histórico

Com Python 3.8 ou superior, guarde um CSV Nubank por período, fora deste diretório e sem sobrepor datas entre extratos. Na raiz do projeto, rode:

```sh
python3 gerar_dados.py --favorecido-quadra "NOME DO CLUBE NO EXTRATO" --mensalidade-centavos 8500 ~/extratos-futebol/*.csv
```

A cada mês, acrescente o novo extrato à pasta privada e rode o comando com **todos** os CSVs. O script recria o `data.json` com o histórico completo e recusa lançamentos com identificador repetido. O JSON contém data em formato ISO, valor em centavos, categoria genérica quando reconhecida e, nas transferências recebidas com pagador identificado, o primeiro nome e a inicial do último sobrenome. Revise o JSON e versione a atualização.

O gerador identifica os pagamentos ao clube pelo favorecido e classifica os demais Pix enviados como despesas com goleiros. Em outubro, o valor de R$ 85,00 foi usado para identificar recebimentos de mensalidade pelo padrão do extrato. A contagem é de recebimentos, sem confirmação individual por mensalista. O parâmetro vale para todos os CSVs da execução.

## Testar localmente

O histórico exclui os dois Pix de teste de 19/10/2026, uma entrada e uma saída de R$ 0,01.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra [localhost:8000](http://127.0.0.1:8000), selecione um mês e confira os totais e as movimentações.

## Publicar no GitHub Pages

Envie os arquivos do projeto para a branch `main`. No repositório do GitHub, abra **Settings → Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, selecione **main** e **/(root)** e clique em **Save**. O endereço aparecerá na mesma tela após a publicação. A página e o JSON ficam acessíveis publicamente. [Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
