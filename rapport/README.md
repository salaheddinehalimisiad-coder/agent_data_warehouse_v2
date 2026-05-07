# Rapport mini-projet — Agent-Assisted Data Warehouse

Source LaTeX du rapport académique du mini-projet présenté à l'EMP.

## Compilation

### Option 1 — Local (Windows + MiKTeX/TeX Live)

```powershell
cd C:\Users\salah\Desktop\agent_dw_v3_fixed\rapport
pdflatex rapport.tex
pdflatex rapport.tex   # 2e passe pour TOC, refs croisees
pdflatex rapport.tex   # 3e passe pour la bibliographie
```

### Option 2 — Online (Overleaf)

1. Aller sur https://overleaf.com → New Project → Upload Project
2. Uploader `rapport.tex`
3. Cliquer **Recompile**

### Option 3 — Docker LaTeX

```bash
docker run --rm -v $PWD:/data texlive/texlive pdflatex /data/rapport.tex
```

## Structure du rapport

- Page de garde (EMP, ANP)
- Dédicaces (à mes parents, mon encadreur Cpt HAMOUDA Sidehoum, etc.)
- Remerciements
- Résumé FR / Abstract EN
- Table des matières + listes (figures, tableaux, acronymes)
- **Introduction générale**
- **Chapitre I** — Concepts fondamentaux (DW, ETL, Kimball, multi-agents, LLM)
- **Chapitre II** — État de l'art (dbt, Airbyte, Fivetran, Talend, agents IA)
- **Chapitre III** — Conception et implémentation du système Agent DW
- **Conclusion générale**
- **Bibliographie** (22 références)

## Adaptation pour la soutenance

Pour ajouter des figures, créez un sous-dossier `figures/` et incluez-les via :

```latex
\begin{figure}[H]
  \centering
  \includegraphics[width=0.8\textwidth]{figures/architecture.png}
  \caption{Architecture du système}
  \label{fig:architecture}
\end{figure}
```

Les screenshots à capturer :
- Architecture globale du pipeline (graphe LangGraph)
- Capture d'écran de l'UI Atlas (chat flottant)
- Star schema généré pour Northwind
- Rapport Excel ouvert (feuille KPI)
- Dashboard Grafana
- Diff DDL avant/après modification Kimball
