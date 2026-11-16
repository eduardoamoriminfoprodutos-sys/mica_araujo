"""Monta o artefato (arquivo único) DESTE salão, só a partir deste repositório.
Uso, na raiz do repositório:  python3 ferramentas/montar-artefato.py <arquivo de saída .html>
Junta comum/estilos.css + marca.js (com o logo.png embutido) + o corpo de demo/index.html + os scripts.
O resultado abre sozinho (sem servidor) e é o que se publica como artefato no claude.ai."""
import sys, base64, re, pathlib
repo = pathlib.Path(__file__).resolve().parent.parent
saida = sys.argv[1] if len(sys.argv) > 1 else "artefato.html"
r = lambda p: (repo / p).read_text(encoding="utf-8")
marca = r("marca.js")
nome = re.search(r'nomeCompleto:\s*"([^"]+)"', marca).group(1)
fundo = (re.search(r'"--bg":\s*"([^"]+)"', marca) or re.search(r"--bg:\s*([^;]+);", r("comum/estilos.css"))).group(1).strip()
logo = "data:image/png;base64," + base64.b64encode((repo / "logo.png").read_bytes()).decode()
marca = marca.replace('const pasta = new URL(".", document.currentScript.src).href;', 'const pasta = "";').replace('pasta + "logo.png"', '"' + logo + '"')
corpo = re.search(r"<body>(.*?)<script>", r("demo/index.html"), re.S).group(1)
js = "\n".join(r(p) for p in ["comum/nucleo.js", "comum/dados.js", "cliente/cliente.js", "salao/salao.js"])
html = f'''<meta charset="utf-8">
<title>{nome} · Agendamento</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="{fundo}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap">
<style>
{r("comum/estilos.css")}
</style>
<script>
{marca}
</script>
{corpo}
<script>
window.FAV_MODO = "demo";
{js}
iniciar();
</script>
'''
pathlib.Path(saida).write_text(html, encoding="utf-8")
print(f"{nome}: {saida} ({len(html)//1024} KB)")
