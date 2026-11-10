# Identidade visual

O símbolo do programa **Envelhecer nos Territórios** é a logo principal, o ícone
da PWA e o destaque da tela inicial. As logos institucionais do **IFRJ** e do
**IFMG** aparecem no rodapé da tela inicial, lado a lado, acima da versão.

> As marcas institucionais exigem autorização de uso. O nome **My ODK Client**
> usa a marca "ODK" da Get ODK Inc. e não deve ser apresentado como produto
> oficial (`PLAN.md` §12).

## Arquivos

| Arquivo | Uso |
|---|---|
| `icon-source.png` | símbolo com fundo transparente; fonte dos ícones |
| `icon-192.png` | `purpose: any` |
| `icon-512.png` | `purpose: any` |
| `icon-maskable-512.png` | `purpose: maskable` — arte dentro dos 80% centrais |

As cópias em uso ficam em `frontend/public/icons/` (ícones) e em
`frontend/public/branding/` (logo da tela inicial e logos institucionais).

## Origem

- Símbolo: `https://hmg-mdhc.ifrj.edu.br/assets/logos/simbolo-envelhecer.png`
  (fundo branco removido; arte recortada).
- IFMG: `https://www.ifmg.edu.br/portal/comunicacao/logo/logo-ifmg/ifmg-vertical.png`
  (já transparente; margens recortadas).
- IFRJ: thumbnail do Google `encrypted-tbn0.gstatic.com` (402×497; fundo branco
  removido). Substituir pelo arquivo oficial quando estiver disponível.

## Regenerar

```bash
python3 assets/branding/generate-icons.py
cp assets/branding/icon-192.png assets/branding/icon-512.png \
   assets/branding/icon-maskable-512.png frontend/public/icons/
```

A fonte precisa ter fundo transparente e a arte dentro da área segura central: o
Android recorta ícones `maskable` em círculo ou "squircle", e qualquer coisa nas
bordas desaparece.
