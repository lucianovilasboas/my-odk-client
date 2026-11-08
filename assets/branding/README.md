# Identidade visual (provisória)

> Ícone provisório, a substituir por identidade definitiva antes de distribuição
> pública. O nome **My ODK Client** usa a marca "ODK" da Get ODK Inc. e não deve
> ser apresentado como produto oficial (`PLAN.md` §12).

## Arquivos

| Arquivo | Uso |
|---|---|
| `icon-source.png` | fonte quadrada, alta resolução |
| `icon-192.png` | `purpose: any` |
| `icon-512.png` | `purpose: any` |
| `icon-maskable-512.png` | `purpose: maskable` — arte dentro dos 80% centrais |

## Regenerar

```bash
python3 assets/branding/generate-icons.py
```

A fonte precisa ser quadrada e ter a arte dentro da área segura central: o Android
recorta ícones `maskable` em círculo ou "squircle", e qualquer coisa nas bordas
desaparece.

`theme_color` e `background_color` do manifesto serão fixados quando a identidade
definitiva for aprovada; até lá, usar o fundo da fonte.
