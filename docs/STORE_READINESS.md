# Prontidão para as lojas (seção 10.6) — 21/11/2026

| Item | Situação | Observação |
| --- | --- | --- |
| Build estático separado (`output: 'export'`) passa | **Pronto** | `npm run check:static-build`, também no CI |
| Telas do app só pelo `lib/api-client` | **Pronto** | `npm run check:portability` no CI |
| Camada `lib/platform` (microfone, áudio, notificações, armazenamento, compartilhar, arquivos, links, compras) | **Pronto na web** | implementação nativa (Capacitor) é da Fase 2; exportar dados e PDF já usam `files.save` |
| API em `/api/v1` com `Authorization: Bearer`, `X-App-Version`, `X-Platform` | **Pronto** | sem cookie de sessão |
| Acesso pago só por `lib/entitlements` | **Pronto** | cobrança via adaptador (simulado hoje, Asaas depois) |
| Compras dentro do app (Apple/Google) | **Pendente (Fase 2)** | hoje o pagamento é direto (Pix/cartão); lojas exigem compra nativa para conteúdo digital ou regra de leitura; decidir com a Fase 2 |
| Login com Apple | **Pendente** | obrigatório no iOS se houver outro login social; hoje só e-mail/senha. Tarefa antes de publicar na App Store |
| Exclusão de conta dentro do app | **Pronto** | Conta > Excluir (testado) |
| Exportar dados (LGPD) | **Pronto** | Conta > Baixar meus dados |
| Inventário de dados atualizado | **Pronto** | `docs/STORE_DATA_INVENTORY.md` a cada módulo |
| Interface com cara de app (barra inferior, sem links soltos, áreas seguras) | **Pronto** | Lighthouse acessibilidade 100 |
| Ícones e tela de abertura | **Parcial** | ícones 192/512 prontos; falta o conjunto completo de ícones e splash por tamanho para o Capacitor |
| Política de privacidade com encarregado publicado | **Pendente** | depende de você (D-12) |
| Classificação etária e questionário de dados das lojas | **Pendente (Fase 2)** | usar o inventário como base |
| Notificações push | **Pendente (Fase 2)** | interface existe em `lib/platform`; falta a implementação nativa |

Tarefas antes do beta: nenhuma bloqueia o beta web. Antes das lojas: login com Apple, compras nativas, ícones/splash, DPO.
