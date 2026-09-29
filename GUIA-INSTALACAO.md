# 📺 Dashboard TV — Guia Completo de Instalação

---

## Visão Geral

```
[Você, de qualquer lugar]
        │
        ▼
   Admin Web (Render)        ← Configura salões, TVs e URLs
        │
        ▼
   Cada TV abre sua URL      ← Ex: https://seu-app.onrender.com?room=abc&tv=xyz
        │
        ▼
  Intelbras Android TV      ← Exibe os dashboards em modo kiosk
```

---

## PARTE 1 — Publicar o App na Internet

### Pré-requisitos
- Conta gratuita no **GitHub**: https://github.com
- Conta gratuita no **Render**: https://render.com
- Conta gratuita no **Upstash**: https://upstash.com (recomendado para salvar a configuração)

---

### Passo 1 — Extrair e preparar o projeto

1. Extraia o projeto na pasta desejada, mantendo o seu arquivo `.env` no mesmo local
2. Abra o terminal (CMD, PowerShell ou Terminal Mac) nessa pasta
3. Execute:

```bash
npm install
npm run local
```

Acesse `http://localhost:3000` para testar. O terminal informa se a configuração está sendo salva no Upstash, em Redis ou no arquivo local `data/config.json`. Sem banco configurado, os dados ficam apenas nesse computador.

---

### Passo 2 — Subir no GitHub

1. Acesse https://github.com e clique em **New repository**
2. Nome sugerido: `tv-dashboard`
3. Deixe **Public** e clique em **Create repository**
4. No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/tv-dashboard.git
git push -u origin main
```


### Passo 3 — Criar o banco gratuito no Upstash

1. Acesse https://upstash.com, crie uma conta e crie um banco **Redis** na região mais próxima
2. No painel do banco, copie **UPSTASH_REDIS_REST_URL** e **UPSTASH_REDIS_REST_TOKEN**

---

### Passo 4 — Publicar no Render

1. No Render, selecione **New → Blueprint** e conecte o repositório `tv-dashboard`
2. O Render encontrará o arquivo `render.yaml`. Confirme a criação do serviço
3. Preencha as variáveis solicitadas:
   - `ADMIN_PASSWORD`: defina uma senha forte para o Admin
   - `UPSTASH_REDIS_REST_URL`: URL REST copiada do Upstash
   - `UPSTASH_REDIS_REST_TOKEN`: token copiado do Upstash
4. Aguarde o deploy. A URL será parecida com `https://tv-dashboard.onrender.com`

> O Upstash é recomendado porque o disco do serviço gratuito do Render é temporário. Sem banco, o app usa um arquivo local, que não é persistente no Render.

> Também são aceitos os nomes antigos `KV_REST_API_URL` e `KV_REST_API_TOKEN`, além de `REDIS_URL` para Redis comum.

Depois do deploy, abra o Admin e informe a senha. As alterações são salvas automaticamente; as TVs buscam mudanças a cada 60 segundos. A leitura da configuração é pública, então URLs cadastradas podem ser consultadas por quem tiver acesso à aplicação.

No plano gratuito do Render, o serviço pode dormir após 15 minutos sem acesso e pode levar um pouco para responder à primeira solicitação. Com as TVs consultando a cada 60 segundos, ele tende a permanecer ativo. O limite gratuito informado pelo Render é de 750 horas por mês.

---

### Passo 5 — Configurar os salões e TVs
**URL pública (exemplo):**
https://tv-dashboard.onrender.com

1. Acesse a URL do Render no seu computador
2. Na tela Admin, configure cada salão:
   - Renomeie os salões (ex: "Vendas", "Suporte", "Operações")
   - Adicione as TVs de cada salão (até 4 por salão)
   - Para cada TV, adicione as telas:
     - **Nome**: Power BI / Olos / Call Flex
     - **URL**: cole a URL completa do dashboard
     - **Intervalo**: tempo em segundos para trocar
3. Para cada TV, clique em **Copiar** para pegar a URL única dela

**Exemplo de URL por TV:**
```
TV 1 do Salão Vendas:
https://tv-dashboard.onrender.com?room=r1abc&tv=t2xyz
```

---

## PARTE 2 — Instalar nas TVs Intelbras

### Identificar o modelo

| Modelo | Sistema | Caminho |
|--------|---------|---------|
| Intelbras com Android TV | Android TV / Google TV | Instalar app pelo Play Store |
| Intelbras com Android puro | Android | Instalar APK ou browser |
| Outros | — | Verificar com o suporte Intelbras |

---

### Opção A — Intelbras com Android TV (recomendado)

#### Instalar o Fully Kiosk Browser

1. Na TV, abra o **Google Play Store**
2. Pesquise por: **Fully Kiosk Browser**
3. Instale o app (é gratuito com funcionalidades básicas)

#### Configurar o Fully Kiosk

1. Abra o **Fully Kiosk Browser**
2. Vá em **Settings** (ícone de engrenagem)
3. Configure:

| Configuração | Valor |
|---|---|
| **Start URL** | URL da TV (ex: `https://tv-dashboard.onrender.com?room=r1&tv=t1`) |
| **Autostart on Boot** | ✅ Ativado |
| **Keep Screen On** | ✅ Ativado |
| **Show Navigation Bar** | ❌ Desativado |
| **Enable Kiosk Mode** | ✅ Ativado |
| **Exit Kiosk Mode Password** | Defina uma senha |

4. Volte à tela inicial e toque em **Start** ou **Go to Start URL**
5. A TV vai abrir o dashboard em tela cheia

---

### Opção B — Sem Play Store (sideload)

Se a Intelbras não tiver Play Store, instale o browser via USB:

1. Baixe o APK do Fully Kiosk em outro dispositivo:
   `https://www.fully-kiosk.com/en/#download`
2. Coloque o APK num pendrive FAT32
3. Conecte o pendrive na TV
4. Vá em **Configurações → Aplicativos → Fontes desconhecidas** → Ativar
5. Abra o gerenciador de arquivos da TV, encontre o APK e instale
6. Siga os mesmos passos da Opção A para configurar

---

### Opção C — Chrome/Browser nativo em modo Kiosk

Se a TV já tiver Chrome instalado:

1. Abra o Chrome na TV
2. Navegue até a URL da TV
3. Pressione **F11** ou vá em menu → **Tela cheia**
4. Para iniciar automaticamente: configure nas opções de acessibilidade da TV

---

## PARTE 3 — Configurar Inicialização Automática

### Na Intelbras (Android TV)

Após instalar o Fully Kiosk:

1. Vá em **Configurações da TV → Aplicativos**
2. Defina o **Fully Kiosk** como app padrão de inicialização
   - Algumas TVs: Configurações → Preferências do dispositivo → Inicialização
3. Ative o modo de desenvolvedor se necessário:
   - Configurações → Sobre → Pressione "Build" 7 vezes
   - Depois: Configurações Desenvolvedor → Inicializar sempre com este app

---

## PARTE 4 — Acesso Remoto (Gerenciar as TVs)

### Instalar AnyDesk nas TVs

1. No Play Store da TV, instale o **AnyDesk**
2. Anote o código de 9 dígitos de cada TV
3. No seu computador, abra o AnyDesk e conecte pelo código

> Dessa forma você consegue trocar URLs, reiniciar apps e configurar tudo remotamente sem se deslocar.

---

## PARTE 5 — Troubleshooting

### ❌ "Iframe bloqueado" no Olos ou Call Flex

O sistema de origem bloqueou exibição externa. Soluções:

1. **Pedir ao suporte do Olos/Call Flex** para liberar o header:
   ```
   Content-Security-Policy: frame-ancestors https://SEU-APP.onrender.com
   (e remover X-Frame-Options: DENY/SAMEORIGIN)
   ```

2. **Alternativa**: usar um proxy reverso que remove esses headers. Serviços como
   `allorigins.win` ou um servidor nginx próprio podem fazer isso.

---

### ❌ TV não inicia o app automaticamente

- Verifique se o **Autostart on Boot** está ativado no Fully Kiosk
- Confirme que o app tem permissão de "Iniciar ao ligar" nas configurações do Android

---

### ❌ Tela apaga depois de um tempo

- No Fully Kiosk: Settings → **Keep Screen On** → Ativar
- Na TV: Configurações → Display → **Protetor de tela/Sleep** → Nunca

---

### ❌ URL ficou desatualizada depois de reconfigurar

As URLs contêm IDs únicos gerados ao criar os salões/TVs. Se recriar do zero, as URLs mudam.
**Solução**: não apague as TVs, apenas edite as telas dentro delas.

---

## Resumo Final

```
Computador (uma vez)
├── 1. Extrair o ZIP
├── 2. npm install && npm run local (testar)
├── 3. Subir no GitHub
└── 4. Publicar no Render → URL pública

Admin (qualquer navegador)
├── Configurar 4 salões
├── Adicionar TVs (até 4 por salão)
├── Cadastrar URLs (Power BI, Olos, Call Flex)
└── Copiar URL única de cada TV

Cada Intelbras (uma vez por TV)
├── Instalar Fully Kiosk Browser
├── Colar a URL da TV
├── Ativar Autostart + Keep Screen On + Kiosk Mode
└── Pronto — liga sozinho quando a TV ligar
```

---

**Suporte**: qualquer dúvida, abra o app no Admin e verifique se as URLs estão corretas. O Preview do admin simula exatamente o que a TV vai exibir.
