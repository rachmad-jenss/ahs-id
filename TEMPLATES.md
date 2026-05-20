# Session Templates — Dash Teknologi

> Copy-paste salah satu template di bawah ke awal sesi Claude Code baru.
> Ganti `{REPO}` dan placeholder lainnya sesuai kebutuhan.

---

## Template A: Backlog Eksisting (GitHub Issues + Notion)

```
Sesi ini aku mau mengerjakan backlog isu eksisting.

**Project: {REPO}**

### Step 1 — Scan backlog
- Baca GitHub Issues repo ini yang statusnya open: `gh issue list --repo rachmad-jenss/{REPO} --state open`
- Baca Notion Tasks DB (`collection://2f8c4f5f-1479-4f28-8136-2368d18e2090`) yang statusnya "Next Up", filter Product/App = "{PRODUCT_APP}"
- Cross-check: pastikan semua GitHub Issues ada di Notion (dan sebaliknya). Jika ada yang missing, sinkronkan.
- Tampilkan daftar isu lengkap: Code, Title, Priority, Type, Due, Initiative, Parent Issue

### Step 2 — Sarankan isu untuk dikerjakan
- Dari daftar backlog, pilihkan 2-4 isu yang:
  1. **File-nya TIDAK tumpang tindih** (bisa dikerjakan paralel tanpa merge conflict)
  2. **Priority tertinggi dulu** (P1 → P2 → P3)
  3. **Due terdekat dulu**
- Jelaskan alasan kenapa isu-isu tersebut aman dikerjakan paralel
- Tunggu konfirmasi aku sebelum mulai

### Step 3 — Jalankan FULL workflow per CLAUDE.md
Untuk setiap isu yang dikonfirmasi, ikuti workflow di CLAUDE.md repo ini:

**Phase 0 (Buat issue jika belum ada):**
- Strategic Alignment Check — cek GitHub Issues + Notion Initiatives DB
- Buat di GitHub Issues + Notion (dedup check), isi page content lengkap
- GitHub Issue: `gh issue create --repo rachmad-jenss/{REPO}` (tanpa prefix di title dulu), setelah terbuat catat nomor `{N}` dari output URL lalu rename: `gh issue edit {N} --title "[DAS-{N}] ..."`, label `linear-sync` + type label, catat nomor issue

**Phase 1 (Mulai kerja):**
- Update Notion: Status, Priority, Type, Due, Initiative, Next action → "Coding"
- Revalidasi Issue — baca codebase, cek git log, bandingkan approach. Update Notion jika stale.
- Buat branch dari {DEFAULT_BRANCH}

**Phase 2 (Selesai coding):**
- Commit: `DAS-{N}: deskripsi`
- Codex Code Review (WAJIB) — fix critical issues sebelum buat PR
- Buat Draft PR (`gh pr create --draft`), title include `DAS-{N}`, body include `Closes #{github_issue_number}`
- Push semua fix selama masih draft (CI tidak jalan = hemat minutes)
- Mark Ready for Review (`gh pr ready`) setelah semua fix selesai

**Phase 3 (Post-PR — 3 FASE, JANGAN BERHENTI):**
- FASE A: CI checks → tunggu semua hijau
- FASE B: Review → tunggu minimal 5 menit, poll CodeRabbit + Vercel + Codex, balas & resolve semua komentar
- FASE C: Test plan → MANDATORY, jalankan semua item, checklist di deskripsi PR
- Gunakan `/loop 3m` untuk polling
- Notifikasi aku saat PR ready to merge + summary

**Phase 4 (Post-merge):**
- Notion status → "Done" (biasanya otomatis via `notion-sync.yml`)
- GitHub Issue → "closed" (otomatis via `Closes #N` di PR body; jika tidak, close manual)
- Update Notion page dengan PR link + summary
- *(Linear paused — skip. Saat aktif kembali: update Linear issue ke Done dan link PR.)*
- Cek parent issue — jika semua children Done, update parent juga

Gunakan batch subagent jika >1 isu (pastikan file tidak tumpang tindih).
```

---

## Template B: Improvement Baru

```
Sesi ini aku mau tambahkan improvement/fitur baru.

**Project: {REPO}**

### Fase 1 — Brainstorm & Buat Backlog

Ide improvement:
{DAFTAR_IDE}

Untuk setiap ide:
1. **Strategic Alignment Check** — cek GitHub Issues apakah ada isu serupa, cek Initiatives DB apakah aligned dengan OKR kuartal
2. Breakdown jadi isu teknis yang actionable (1 isu = 1 PR)
3. Tentukan Type (Feature/Bug/Chore/Docs) dan sarankan Priority (P1/P2/P3)
4. Tanya aku deadline
5. Tentukan parent issue — buat parent baru di GitHub Issues + Notion jika perlu
6. Tentukan initiative — cek Initiatives DB (`collection://63a30ec4-8e03-4a69-aaa2-72f29d69af14`), buat baru jika tidak ada yang cocok
7. Setelah aku konfirmasi, buat semuanya sesuai workflow "Buat issue/task baru" di CLAUDE.md:
   - GitHub Issue: `gh issue create --repo rachmad-jenss/{REPO}` (tanpa prefix di title dulu), setelah terbuat catat nomor `{N}` dari output URL lalu rename: `gh issue edit {N} --title "[DAS-{N}] ..."`, label `linear-sync` + type label, catat nomor `DAS-{N}`
   - Notion: search dulu (dedup check) → create/update (semua fields + Initiative + Parent Issue)
   - Notion page: isi lengkap (problem, solution, AC) — jangan blank
   - Deadline & parent issue harus sinkron GitHub Issues ↔ Notion
   - *(Linear paused — skip. Saat aktif kembali: buat di Linear dan update Code Notion ke `DAS-{LinearID}` jika nomor berbeda dari nomor GitHub.)*

### Fase 2 — Pilih & Kerjakan

Setelah semua isu terdaftar:
1. Sarankan 2-4 isu yang bisa dikerjakan **paralel** (file tidak tumpang tindih)
2. Setelah aku konfirmasi, jalankan FULL workflow per CLAUDE.md:
   - Phase 1: Mulai kerja (update Notion + revalidasi + buat branch)
   - Phase 2: Coding + Codex review + Draft PR (include `Closes #{github_issue_number}`) + mark Ready
   - Phase 3: Post-PR 3 fase (CI → Review → Test plan), pakai `/loop 3m`, jangan berhenti sampai semua selesai
   - Phase 4: Post-merge (sync Notion + GitHub Issue → Done/closed + update pages + cek parent issue)
   - Gunakan batch subagent untuk isu paralel
```

---

## Template C: Dash Platform — Digital Thread (Cross-Product)

```
Sesi ini aku mau mengerjakan isu Digital Thread yang melibatkan beberapa product/app sekaligus.

**Project: Dash Platform**
**Repos terlibat: bd-crm-dashboard (Velo), cost-your-project (Estimara), rangko (Rangko)**

### Konteks Digital Thread
Source of Truth rules:
- Project, Budget, Progress → Estimara owns, Rangko caches
- Client master → Velo owns, Rangko caches
- Vendor, Employee, Financial transactions → Rangko owns
- Actual cost data → Rangko owns, pushes to Estimara

### Step 1 — Scan backlog Dash Platform
- Baca GitHub Issues dari masing-masing repo terlibat: `gh issue list --repo rachmad-jenss/{REPO} --state open`
- Baca Notion Tasks DB yang statusnya "Next Up", filter Product/App = "Dash Platform"
- Cross-check GitHub Issues ↔ Notion, sinkronkan jika ada yang missing
- Tampilkan daftar isu: Code, Title, Priority, Due, Initiative, Parent Issue, dan **repo mana saja yang terdampak**

### Step 2 — Analisis dampak cross-repo
Untuk setiap isu Dash Platform:
1. Identifikasi **repo mana saja** yang perlu diubah
2. Identifikasi **interface/contract** antar repo yang terdampak (API, shared Supabase tables, data sync)
3. Tentukan **urutan implementasi** — source of truth → consumer
4. Identifikasi dependency: isu individual mana yang harus selesai dulu

### Step 3 — Sarankan isu untuk dikerjakan
- Pilihkan isu yang dependency-nya terpenuhi
- Breakdown jadi sub-tasks per repo jika perlu
- Jika sub-tasks di beda repo → bisa paralel (beda codebase)
- Jika ada dependency (repo A merge dulu) → jelaskan urutannya
- Tunggu konfirmasi aku

### Step 4 — Jalankan workflow per repo
**Urutan implementasi (WAJIB):**
1. Source of truth repo duluan — implement API/data/schema
2. Consumer repo setelahnya — implement integration setelah source merged
3. Verifikasi cross-repo — test alur end-to-end antar product

Per sub-task, ikuti FULL workflow di CLAUDE.md repo masing-masing (Phase 1-4).

**Setelah SEMUA sub-tasks merged:**
- Update parent Dash Platform issue di Notion + GitHub Issues → "Done"
- GitHub Issues per repo → closed (via `Closes #N` di PR body atau manual)
- Summary di Notion page: perubahan per repo + link semua PR
- Test end-to-end cross-product sesuai Source of Truth rules

Gunakan batch subagent untuk sub-tasks di repo berbeda (paralel aman).
```

---

## Quick Reference: Mapping per Repo

| Kamu bilang... | REPO | PRODUCT_APP | Linear Project | Default Branch |
|---|---|---|---|---|
| "Velo" / "CRM" | `bd-crm-dashboard` | `Velo — CRM Dashboard` | Velo — CRM Dashboard | main |
| "Estimara" | `cost-your-project` | `Estimara — Platform` | Estimara — Platform | main |
| "Dash" / "Marketing" | `dash-teknologi` | `Dash Teknologi` | Dash — Marketing Site | master |
| "Widget" | `velo-widget` | `Velo Widget` | Velo — Desktop Widget | master |
| "HaulPave" | `haul-pave` | `HaulPave — Library` | HaulPave — Library | main |
| "Rangko" | `rangko` | `Rangko — Platform` | Rangko — Platform | main |
| "HaulCalc" | `haul-calc` | `HaulCalc — Desktop App` | — | main |
| "TOS" / "TryOut" | `platform-tryout/platform-tryout` | `TryOutYourShot — Platform` | — | main |
| "Digital Thread" | cross-repo | `Dash Platform` | Dash Platform | — |

## Quick Reference: Workflow Phases

```
Phase 0: Buat issue (Strategic Alignment + GitHub Issues + Notion + Initiative + Parent Issue + Page content)
Phase 1: Mulai kerja (Notion status + fields + revalidasi issue + branch)
Phase 2: Selesai coding (commit DAS-{N} + Codex review + Draft PR [Closes #N] + mark Ready)
Phase 3: Post-PR 3 fase (A: CI → B: Review → C: Test plan → ready to merge)
Phase 4: Post-merge (sync Notion + GitHub Issue closed + update pages + cek parent; Linear skip saat paused)
```
