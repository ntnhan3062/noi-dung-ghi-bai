
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Auth-Pass",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    async function checkPassword(pass) {
        if (!pass) return false;
        if (env.PASS && pass === env.PASS) return true;
        
        try {
            const dbPass = await env.DB.prepare("SELECT value FROM config WHERE key = 'admin_password'").first();
            if (dbPass && dbPass.value === pass) return true;
            if (!dbPass && !env.PASS && pass === 'admin') return true;
        } catch(e) {
            if (pass === 'admin') return true;
        }
        return false;
    }

    try {
      if (url.pathname === "/api/get" && request.method === "GET") {
        const authPass = request.headers.get('X-Auth-Pass');
        if (authPass) {
            const isValid = await checkPassword(authPass);
            if (!isValid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
        try {
            await env.DB.batch([
                env.DB.prepare(`CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, parentId TEXT, type TEXT, title TEXT, content TEXT, createdAt INTEGER, orderIndex INTEGER DEFAULT 0, classId TEXT)`),
                env.DB.prepare(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`)
            ]);
        } catch (e) {}
        const result = await env.DB.prepare("SELECT * FROM nodes ORDER BY orderIndex ASC, createdAt ASC").all();
        return new Response(JSON.stringify(result.results || []), { headers: corsHeaders });
      }

      if (url.pathname === "/api/save" && request.method === "POST") {
        const data = await request.json();
        let orderIndex = data.orderIndex;
        if (orderIndex === undefined || orderIndex === null) {
            if (!data.createdAt) { 
                try {
                    const maxOrderResult = await env.DB.prepare("SELECT MAX(orderIndex) as maxVal FROM nodes WHERE parentId = ? OR (parentId IS NULL AND ? IS NULL)").bind(data.parentId || null, data.parentId || null).first();
                    orderIndex = (maxOrderResult?.maxVal || 0) + 1;
                } catch (e) { orderIndex = 0; }
            } else { orderIndex = 0; }
        }
        await env.DB.prepare(`INSERT OR REPLACE INTO nodes (id, parentId, type, title, content, createdAt, orderIndex, classId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(data.id, data.parentId || null, data.type, data.title, data.content || null, data.createdAt || Date.now(), orderIndex, data.classId || null).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname === "/api/batch-update" && request.method === "POST") {
        const updates = await request.json();
        const stmt = env.DB.prepare(`UPDATE nodes SET orderIndex = ?, parentId = ? WHERE id = ?`);
        const batch = updates.map(u => stmt.bind(u.orderIndex, u.parentId || null, u.id));
        await env.DB.batch(batch);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname === "/api/delete" && request.method === "POST") {
        const { id } = await request.json();
        await env.DB.prepare(`
          DELETE FROM nodes 
          WHERE id IN (
            WITH RECURSIVE descendants AS (
              SELECT id FROM nodes WHERE id = ?
              UNION ALL
              SELECT n.id FROM nodes n JOIN descendants d ON n.parentId = d.id
            )
            SELECT id FROM descendants
          )
        `).bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (url.pathname === "/api/auth/verify" && request.method === "POST") {
        const { password } = await request.json();
        const isValid = await checkPassword(password);
        return new Response(JSON.stringify({ valid: isValid }), { status: isValid ? 200 : 401, headers: corsHeaders });
      }

      if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
        const { newPassword } = await request.json();
        await env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('admin_password', ?)`).bind(newPassword).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // --- API: FULL CONFIG (GET/POST) ---
      if (url.pathname === "/api/config/full" && request.method === "GET") {
        try {
            const keys = ['background_images', 'background_active', 'ui_style', 'zoom_settings', 'classes', 'back_button'];
            const results = await Promise.all(keys.map(k => env.DB.prepare("SELECT value FROM config WHERE key = ?").bind(k).first()));
            
            const [bgImages, bgActive, uiStyle, zoomSettings, classes, backButton] = results;

            const config = {
                classes: classes && classes.value ? JSON.parse(classes.value) : [],
                background: {
                    images: bgImages && bgImages.value ? JSON.parse(bgImages.value) : [],
                    active: bgActive ? bgActive.value === 'true' : false
                },
                ui: {
                    style: uiStyle ? uiStyle.value : 'liquid', 
                    backButton: backButton ? backButton.value !== 'false' : true,
                    zoom: zoomSettings && zoomSettings.value ? JSON.parse(zoomSettings.value) : { view: true, edit: true, app: false }
                }
            };
            return new Response(JSON.stringify(config), { headers: corsHeaders });
        } catch (e) {
            return new Response(JSON.stringify({ classes: [], background: { images: [], active: false }, ui: { style: 'liquid', backButton: true, zoom: { view: true, edit: true, app: false } } }), { headers: corsHeaders });
        }
      }

      if (url.pathname === "/api/config/full" && request.method === "POST") {
        const { background, ui, classes } = await request.json();
        const newClasses = classes || [];
        const newIds = newClasses.map(c => c.id);
        
        const batch = [
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('background_images', ?)`).bind(JSON.stringify(background.images)),
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('background_active', ?)`).bind(String(background.active)),
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('ui_style', ?)`).bind(ui.style),
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('back_button', ?)`).bind(String(ui.backButton !== false)),
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('zoom_settings', ?)`).bind(JSON.stringify(ui.zoom)),
            env.DB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('classes', ?)`).bind(JSON.stringify(newClasses))
        ];

        // Tự động chuyển các môn thuộc lớp đã xóa về "Tất cả các lớp"
        if (!newIds || newIds.length === 0) {
            batch.push(env.DB.prepare(`UPDATE nodes SET classId = NULL WHERE classId IS NOT NULL`));
        } else {
            const placeholders = newIds.map(() => '?').join(',');
            batch.push(env.DB.prepare(`UPDATE nodes SET classId = NULL WHERE classId IS NOT NULL AND classId NOT IN (${placeholders})`).bind(...newIds));
        }

        await env.DB.batch(batch);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
