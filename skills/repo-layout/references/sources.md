# Sources

| Source | Take | Do not take |
|--------|------|-------------|
| [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) (Uncle Bob) | Top-level names scream the product | Framework-first top level |
| Vertical slice / package-by-feature; [domain-driven-hexagon](https://github.com/sairyss/domain-driven-hexagon) | Files that change together live together | Every tiny use-case as a top-level package on day one |
| [Folder structure as AI infrastructure](https://www.shivamgairola.com/blog/your-folder-structure-is-now-part-of-your-ai-infrastructure) (Gairola) | A capability tree makes the home obvious from the path | Illustrated sample trees as a spec |
| [Architecting for agentic AI development on AWS](https://aws.amazon.com/blogs/architecture/architecting-for-agentic-ai-development-on-aws/) | Explicit boundaries | Code-root `/domain /application /infrastructure` as the product layout |
| [Harness engineering](https://openai.com/index/harness-engineering/) (OpenAI) | If you keep `AGENTS.md`, it is a short table of contents | A `docs/` tree instead of a screaming source tree |
| [Microsoft ISE — AGENTS.md and Skills](https://devblogs.microsoft.com/ise/ai-assisted-development-agents-skills-copilot-cli/) | Write the *actual* folders into a map | Their FastAPI `schemas/services/repositories` example as the target tree |
| [ICM / MWP](https://arxiv.org/abs/2603.16021) | Filesystem can orchestrate a *job* | Numbered `01-spec/` stages as application `src/` |
