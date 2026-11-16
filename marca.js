/* ============================================================
   MARCA DO SALÃO
   Para usar o sistema em outro salão, troque só este arquivo
   e o logo.png (logo escura, fundo transparente). Ver README.md.
   ============================================================ */
window.MARCA = (() => {
  const pasta = new URL(".", document.currentScript.src).href;
  return {
    chave: "studio-mica-araujo",                // identificador curto, sem espaço (separa os dados de cada salão)
    nome: "Studio Mica Araujo",                 // nome curto, usado em mensagens ("seu horário no Studio Mica Araujo")
    nomeCompleto: "Studio Mica Araujo",
    logo: pasta + "logo.png",                   // logo escura, para fundo claro (monograma + nome)
    salao: {
      fone: "",                                 // WhatsApp do salão com DDD, só números (FALTA: pedir ao Eduardo)
      mapa: "https://maps.google.com/?q=Studio+Mica+Araujo"   // link do "Como chegar" (FALTA: endereço real)
    },
    /* Paleta tirada da logo: grafite do monograma + rosé queimado (nude) como destaque,
       sobre cinza-pérola. Os nomes "--gold..." são os do sistema base: aqui eles viram o rosé. */
    cores: {
      "--bg": "#F1F0EE",
      "--soft": "#F7F6F4",
      "--muted-bg": "#E9E7E4",
      "--ink": "#2F2F2F",
      "--ink-2": "#4B4848",
      "--ink-3": "#4A4747",
      "--muted": "#76716E",
      "--faint": "#9B9693",
      "--faint-2": "#BEB9B5",
      "--line": "#E1DEDA",
      "--line-2": "#E8E5E2",
      "--gold": "#8A5A52",
      "--gold-mid": "#A9736A",
      "--gold-line": "#CDA197",
      "--gold-light": "#E8C3BA",
      "--gold-tint": "#F3E6E2",
      "--gold-tint-2": "#F9F2F0",
      "--gold-grad": "linear-gradient(135deg, #C08F86, #8C5C55)",
      "--blush": "#EDE4E1",
      "--avatar": "#A9736A",
      "--sh-card": "0 1px 2px rgba(47,47,47,.04), 0 10px 24px -14px rgba(47,47,47,.2)",
      "--sh-gold": "0 16px 32px -12px rgba(140,92,85,.6)"
    }
  };
})();

/* aplica as cores da marca por cima do padrão */
(() => {
  const r = document.documentElement.style;
  Object.entries(window.MARCA.cores || {}).forEach(([k, v]) => r.setProperty(k, v));
  const fundo = (window.MARCA.cores || {})["--bg"], meta = document.querySelector('meta[name="theme-color"]');
  if (fundo && meta) meta.setAttribute("content", fundo);   /* cor da barra do navegador no celular */
})();
