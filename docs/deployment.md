# Vercel 部署與手機安裝

## 部署到 Vercel

1. 將專案推送到 GitHub。
2. 在 Vercel 選擇 **Add New Project**，匯入該 GitHub repository。Framework Preset 使用 Next.js，Root Directory 使用專案根目錄，Build Command 保持 `npm run build`。
3. 在 Vercel Project Settings 的 Environment Variables 設定：

   | Name | 用途 | 環境 |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production、Preview、Development |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/SSR public key | Production、Preview、Development |
   | `SUPABASE_SECRET_KEY` | 邀請、帳戶初始化等 server-only 管理操作 | Production、Preview、Development |

   `SUPABASE_SECRET_KEY` 不可加 `NEXT_PUBLIC_` 前綴，也不要提交 `.env.local`。本機變數名稱可參考根目錄的 `.env.example`。

4. 按 **Deploy**。之後推送至 GitHub 預設分支會觸發 Production deployment，其他分支會建立 Preview deployment。
5. 若新增或修改 Vercel Environment Variables，需重新部署才會套用。

## Supabase Auth URLs

在 Supabase Dashboard 開啟 **Authentication → URL Configuration**：

- **Site URL** 設為正式站網址，例如 `https://your-project.vercel.app`。使用自訂網域時，改成正式自訂網域。
- **Redirect URLs** 加入 `http://localhost:3000/**`、正式站 `https://your-project.vercel.app/**`，以及實際使用的自訂網域 `https://app.example.com/**`。
- 若要測試 Vercel Preview deployment，另加入符合該專案與 team 網域的 Preview URL pattern；避免開放不必要的通用網域。

目前 Email 註冊使用 Supabase 設定的 Site URL 作為驗證後目的地。若未來新增自訂 callback path，需同時加入 Redirect URLs 並更新 Auth flow。

## 手機安裝

部署到 HTTPS 網域後，瀏覽器可讀取 App Router 產生的 Web Manifest 與圖示：

- iPhone/iPad：以 Safari 開啟網站，使用分享選單的「加入主畫面」。
- Android：以 Chrome 開啟網站，使用選單的「安裝應用程式」或「加到主畫面」。

安裝版以 standalone 模式開啟。Supabase session 使用長效 cookie；使用者仍可能因登出、管理員撤銷 session 或 Supabase Auth session policy 而需要重新登入。

資料庫更新請依序在 Supabase SQL Editor 執行 `20261004000000_household_preferences.sql` 與 `20261005000000_household_sharing.sql`，再測試邀請和預設帳戶功能。