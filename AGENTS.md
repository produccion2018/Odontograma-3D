<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Odontograma 3D
- Pure data/math for the dentition lives in `src/lib/odontogram/` (FDI defs, arch placement, procedural geometry); React/three code lives in `src/components/odontogram/`. Keeps the geometry testable and framework-free.
- `Odontogram3D` is a reusable controlled/uncontrolled component (`value`/`defaultValue`/`onChange`); routes only wire it to app state. Keeps the 3D view integrable into the existing odontogram.
- Any route rendering the WebGL canvas must set `ssr: false` — canvas textures need the DOM.
