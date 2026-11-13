/*
 * Tracking do site publico.
 *
 * Servido pelo backend em /api/public/track.js para existir uma copia so — os
 * tres frontends sao apps vite separados e duplicar o arquivo garantiria que
 * um deles ficasse pra tras. O `site` NAO vai no corpo: o backend resolve pelo
 * Host, igual ao formulario de contato.
 *
 * Sem cookie, sem terceiro: o id de sessao e um uuid em localStorage que expira
 * com 30 min de inatividade.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/public/events";
  var FORGET_ENDPOINT = "/api/public/tracking/forget";
  var STORAGE_KEY = "talimpo_track_session";
  var ATTRIBUTION_KEY_PREFIX = "talimpo_attribution:";
  var PRIVACY_KEY_PREFIX = "talimpo_privacy:";
  var SESSION_TTL = 30 * 60 * 1000;
  var ATTRIBUTION_TTL = 90 * 24 * 60 * 60 * 1000;
  var FLUSH_SIZE = 8;
  var FLUSH_DELAY = 3000;
  var trackingScript = document.currentScript;

  function doNotTrackEnabled() {
    var values = [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack];
    return values.some(function (value) {
      var normalized = String(value || "").toLowerCase();
      return normalized === "1" || normalized === "yes";
    });
  }

  function normalizeLabel(value, maxLength) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength || 80);
  }

  function siteScope() {
    var configured = trackingScript && (
      trackingScript.getAttribute("data-site") ||
      trackingScript.getAttribute("data-au-site")
    );
    return normalizeLabel(configured || location.hostname || "falcao", 63) || "falcao";
  }

  function attributionKey() {
    return ATTRIBUTION_KEY_PREFIX + siteScope();
  }

  function privacyKey() {
    return PRIVACY_KEY_PREFIX + siteScope();
  }

  function readPrivacy() {
    try {
      var raw = JSON.parse(
        localStorage.getItem(privacyKey()) ||
        localStorage.getItem("au_privacy:" + siteScope()) ||
        "null"
      );
      return {
        analytics: raw && raw.analytics === "objected" ? "objected" : "enabled",
        marketing: raw && (raw.marketing === "granted" || raw.marketing === "denied") ? raw.marketing : "unset",
        version: raw && typeof raw.version === "string" ? raw.version : "2026-08-30",
        updated_at: raw && typeof raw.updated_at === "string" ? raw.updated_at : "",
      };
    } catch (e) {
      return { analytics: "enabled", marketing: "unset", version: "2026-08-30", updated_at: "" };
    }
  }

  function writePrivacy(next) {
    var state = {
      analytics: next.analytics === "objected" ? "objected" : "enabled",
      marketing: next.marketing === "granted" || next.marketing === "denied" ? next.marketing : "unset",
      version: "2026-08-30",
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(privacyKey(), JSON.stringify(state));
    } catch (e) {
      /* storage bloqueado: a escolha vale nesta pagina */
    }
    return state;
  }

  function readStoredAttribution() {
    try {
      var state = JSON.parse(
        localStorage.getItem(attributionKey()) ||
        localStorage.getItem("au_attribution:" + siteScope()) ||
        "null"
      );
      if (!state || !state.attribution_id || !state.expires_at || new Date(state.expires_at).getTime() <= Date.now()) {
        localStorage.removeItem(attributionKey());
        localStorage.removeItem("au_attribution:" + siteScope());
        return null;
      }
      return state;
    } catch (e) {
      return null;
    }
  }

  function forgetTracking() {
    var state = readStoredAttribution();
    try {
      localStorage.removeItem(attributionKey());
      localStorage.removeItem("au_attribution:" + siteScope());
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("au_track_session");
    } catch (e) {
      /* o estado local pode nao existir */
    }
    if (state && state.attribution_id && window.fetch) {
      fetch(FORGET_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attribution_id: state.attribution_id }),
        keepalive: true,
      }).catch(function () {
        /* a copia local ja foi apagada */
      });
    }
  }

  function emitPrivacyChange(state) {
    try {
      window.dispatchEvent(new CustomEvent("talimpoprivacychange", { detail: state }));
    } catch (e) {
      /* CustomEvent pode estar indisponivel em browsers antigos */
    }
  }

  var privacyContract = {
    get: readPrivacy,
    set: function (choice) {
      var current = readPrivacy();
      var next = writePrivacy({
        analytics: choice && choice.analytics ? choice.analytics : current.analytics,
        marketing: choice && choice.marketing ? choice.marketing : current.marketing,
      });
      if (next.analytics === "objected") forgetTracking();
      if (next.marketing === "granted") loadMarketingScripts();
      emitPrivacyChange(next);
      return next;
    },
    forget: function () {
      var next = writePrivacy({ analytics: "objected", marketing: readPrivacy().marketing });
      forgetTracking();
      emitPrivacyChange(next);
    },
  };

  window.talimpoPrivacy = privacyContract;
  window.auPrivacy = privacyContract;

  // O CMS usa o mesmo bundle do site: medir o time la dentro poluiria o painel.
  if (location.pathname.indexOf("/cms") === 0) return;
  if (doNotTrackEnabled()) return;
  if (readPrivacy().analytics === "objected") return;

  var queue = [];
  var timer = null;
  var sent = {};
  var visibleMs = 0;
  var lastShownAt = Date.now();
  var paginaAtual = location.pathname;

  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {
      /* sem crypto: cai no fallback */
    }
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function attribution() {
    var now = Date.now();
    var current = readStoredAttribution();
    var candidate = candidateTouch();
    if (!current) {
      var expiresAt = new Date(now + ATTRIBUTION_TTL).toISOString();
      current = {
        attribution_id: uuid(),
        expires_at: expiresAt,
        first_touch: stampTouch(candidate, now, expiresAt),
        last_touch: stampTouch(candidate, now, expiresAt),
      };
    } else if (candidate.source !== "direct" && touchIdentity(candidate) !== touchIdentity(current.last_touch || {})) {
      current.last_touch = stampTouch(candidate, now, current.expires_at);
    }
    try {
      localStorage.setItem(attributionKey(), JSON.stringify(current));
    } catch (e) {
      attribution.fallback = current;
    }
    return current;
  }

  function session() {
    var now = Date.now();
    var currentAttribution = attribution();
    try {
      var raw = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem("au_track_session") ||
        "null"
      );
      if (!raw || !raw.id || now - raw.t >= SESSION_TTL) {
        raw = { id: uuid(), t: now, attribution_id: currentAttribution.attribution_id };
      } else {
        raw.t = now;
        // Sessões criadas por uma versão anterior do tracker ainda funcionam.
        raw.attribution_id = currentAttribution.attribution_id;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      return raw;
    } catch (e) {
      // Modo privado/storage bloqueado: sessao vive so nesta pagina.
      return (session.fallback = session.fallback || { id: uuid(), attribution_id: currentAttribution.attribution_id });
    }
  }

  function device() {
    var w = window.innerWidth;
    return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  }

  function metaPixelId() {
    var configured = trackingScript && (
      trackingScript.getAttribute("data-meta-pixel-id") ||
      trackingScript.getAttribute("data-meta-pixel-id")
    );
    if (!configured) {
      var marker = document.querySelector("script[data-meta-pixel-id], script[data-meta-pixel-id]");
      configured = marker && (marker.getAttribute("data-meta-pixel-id") || marker.getAttribute("data-meta-pixel-id"));
    }
    return /^\d{5,30}$/.test(configured || "") ? configured : "";
  }

  function loadMarketingScripts() {
    var pixelId = metaPixelId();
    if (!pixelId || document.querySelector("script[data-meta-pixel='" + pixelId + "'], script[data-au-meta-pixel='" + pixelId + "']")) return;
    window.fbq = window.fbq || function () {
      window.fbq.callMethod
        ? window.fbq.callMethod.apply(window.fbq, arguments)
        : window.fbq.queue.push(arguments);
    };
    if (!window.fbq.queue) {
      window.fbq.queue = [];
      window.fbq.loaded = true;
      window.fbq.version = "2.0";
    }
    window._fbq = window.fbq;
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.setAttribute("data-meta-pixel", pixelId);
    script.setAttribute("data-au-meta-pixel", pixelId);
    document.head.appendChild(script);
  }

  function referrer() {
    try {
      var ref = document.referrer;
      // Navegacao interna nao e origem de trafego.
      return ref && new URL(ref).host !== location.host ? ref.slice(0, 255) : "";
    } catch (e) {
      return "";
    }
  }

  function utm() {
    var params = new URLSearchParams(location.search);
    return {
      utm_source: (params.get("utm_source") || "").slice(0, 120),
      utm_medium: (params.get("utm_medium") || "").slice(0, 120),
      utm_campaign: (params.get("utm_campaign") || "").slice(0, 120),
      utm_content: (params.get("utm_content") || "").slice(0, 120),
    };
  }

  function referrerHost() {
    try {
      var referrerUrl = new URL(document.referrer);
      if (!document.referrer || referrerUrl.hostname === location.hostname) return "";
      return normalizeLabel(referrerUrl.hostname.replace(/^www\./i, ""), 120);
    } catch (e) {
      return "";
    }
  }

  function readUtm() {
    var params = new URLSearchParams(location.search);
    return {
      source: normalizeLabel(params.get("utm_source"), 80),
      medium: normalizeLabel(params.get("utm_medium"), 80),
      campaign: normalizeLabel(params.get("utm_campaign"), 80),
      term: normalizeLabel(params.get("utm_term"), 80),
      content: normalizeLabel(params.get("utm_content"), 80),
      placement: normalizeLabel(params.get("placement"), 80),
      has_fbclid: params.has("fbclid"),
    };
  }

  function sourceFromReferrer(host) {
    if (!host) return { source: "direct", medium: "none" };
    if (/(^|\.)instagram\.com$/.test(host)) return { source: "instagram", medium: "social" };
    if (/(^|\.)facebook\.com$/.test(host)) return { source: "facebook", medium: "social" };
    if (/(^|\.)linkedin\.com$/.test(host)) return { source: "linkedin", medium: "social" };
    if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") return { source: "youtube", medium: "social" };
    if (/(^|\.)(twitter|x)\.com$/.test(host)) return { source: "twitter", medium: "social" };
    if (/(^|\.)google\./.test(host)) return { source: "google", medium: "organic" };
    return { source: host, medium: "referral" };
  }

  function candidateTouch() {
    var marks = readUtm();
    var host = referrerHost();
    var classified = marks.source || marks.medium || marks.campaign || marks.term || marks.content || marks.placement
      ? { source: marks.source || "utm", medium: marks.medium || "unspecified" }
      : marks.has_fbclid
        ? { source: "meta", medium: "paid" }
        : sourceFromReferrer(host);
    return {
      source: classified.source,
      medium: classified.medium,
      campaign: marks.campaign,
      term: marks.term,
      content: marks.content,
      placement: marks.placement,
      referrer_host: host,
      landing_page: location.pathname.slice(0, 255) || "/",
    };
  }

  function touchIdentity(touch) {
    return [touch.source, touch.medium, touch.campaign, touch.term, touch.content, touch.placement, touch.referrer_host].join("|");
  }

  function stampTouch(touch, now, expiresAt) {
    return {
      source: touch.source,
      medium: touch.medium,
      campaign: touch.campaign,
      term: touch.term,
      content: touch.content,
      placement: touch.placement,
      referrer_host: touch.referrer_host,
      landing_page: touch.landing_page,
      captured_at: new Date(now).toISOString(),
      expires_at: expiresAt,
    };
  }

  function push(event, extra) {
    // O corte no load nao pega quem entra na raiz e navega ate /cms sem
    // recarregar; usa `paginaAtual` porque no unload o evento pertence a pagina
    // que esta saindo, nao a que entrou.
    if (paginaAtual.indexOf("/cms") === 0) return;

    var currentSession = session();
    var origin = attribution();
    var touch = origin.last_touch || {};
    var base = {
      session_id: currentSession.id,
      attribution_id: origin.attribution_id,
      event: event,
      target: "",
      page: location.pathname.slice(0, 255),
      referrer: touch.referrer_host || "",
      device: device(),
      dwell_ms: 0,
      pos_x: 0,
      pos_y: 0,
      occurred_at: new Date().toISOString(),
    };
    base.utm_source = touch.source || "";
    base.utm_medium = touch.medium || "";
    base.utm_campaign = touch.campaign || "";
    base.utm_term = touch.term || "";
    base.utm_content = touch.content || "";
    base.placement = touch.placement || "";
    for (var extraKey in extra) base[extraKey] = extra[extraKey];

    queue.push(base);
    if (queue.length >= FLUSH_SIZE) return flush();
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY);
  }

  function flush(useBeacon) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length) return;
    var body = JSON.stringify({ events: queue.splice(0, 50) });

    // No unload so o sendBeacon sobrevive; fetch normal e cancelado.
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {
      /* metrica nunca quebra a pagina */
    });
  }

  function once(key, event, extra) {
    if (sent[key]) return;
    sent[key] = true;
    push(event, extra);
  }

  // -- rotulo do clique / campo ------------------------------------------

  function label(el) {
    var marcado = el.closest("[data-track]");
    var texto = (el.textContent || "").trim().replace(/\s+/g, " ");
    var base = marcado
      ? marcado.getAttribute("data-track")
      : texto || el.getAttribute("aria-label") || el.tagName.toLowerCase();

    // A secao entra no rotulo porque o mesmo texto se repete pela pagina
    // (o mesmo CTA pode aparecer varias vezes): sem isso os cliques dos
    // quatro CTAs virariam uma linha so no painel. O modal da jornada tira o
    // sufixo na exibicao.
    var secao = el.closest("section[id], header[id], footer[id]");
    return (secao ? base + " @ " + secao.id : base).slice(0, 200);
  }

  function fieldLabel(el) {
    var text = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    if (/^Campo\b/i.test(text)) return text.slice(0, 200);
    return ("Campo · " + text).slice(0, 200);
  }

  // -- eventos ------------------------------------------------------------

  function pushRouteView() {
    push("pageview");
    // O índice /cases e /guias não é um case/guia: só detalhes contam no passo do funil.
    if (/^\/(?:cases|guias)\/[^/]+\/?$/.test(location.pathname)) push("case_view");
  }

  if (readPrivacy().marketing === "granted") loadMarketingScripts();
  pushRouteView();

  // Em SPA, trocar de rota nao recarrega a pagina, entao sem
  // isto o unico pageview e o da entrada e todo case/artigo aparece como "/" no
  // painel. `sent` zera junto porque scroll e form_open valem por pagina.
  function rotaMudou() {
    if (location.pathname === paginaAtual) return; // replaceState so de querystring
    pushDwell(paginaAtual);
    paginaAtual = location.pathname;
    sent = {};
    pushRouteView();
  }

  ["pushState", "replaceState"].forEach(function (nome) {
    var original = history[nome];
    history[nome] = function () {
      var resultado = original.apply(this, arguments);
      rotaMudou();
      return resultado;
    };
  });
  window.addEventListener("popstate", rotaMudou);

  document.addEventListener(
    "click",
    function (evt) {
      var el = evt.target instanceof Element ? evt.target.closest("a, button, [data-track]") : null;
      if (!el) return;
      var rect = el.getBoundingClientRect();
      // Posicao do clique DENTRO do elemento, em %: e o dado do mapa de calor.
      var x = rect.width ? ((evt.clientX - rect.left) / rect.width) * 100 : 0;
      var y = rect.height ? ((evt.clientY - rect.top) / rect.height) * 100 : 0;
      push("click", {
        target: label(el),
        pos_x: Math.max(0, Math.min(100, Math.round(x))),
        pos_y: Math.max(0, Math.min(100, Math.round(y))),
      });

      var href = (el instanceof HTMLAnchorElement ? el.href : el.getAttribute("href") || "") || "";
      if (href.indexOf("wa.me") !== -1 || href.indexOf("api.whatsapp.com") !== -1) {
        var waTarget = (el.getAttribute("data-whatsapp-target") || el.getAttribute("data-track") || "").toLowerCase().trim();
        var allowed = ["lista", "cotacao", "bairro", "produto", "flutuante"];
        if (allowed.indexOf(waTarget) === -1) {
          if (el.classList.contains("fab") || el.closest(".fab") || el.id === "floating-whatsapp") {
            waTarget = "flutuante";
          } else if (el.closest(".bairro-checker")) {
            waTarget = "bairro";
          } else if (el.closest(".cot-form")) {
            waTarget = "cotacao";
          } else if (location.pathname.indexOf("/produtos/") === 0) {
            waTarget = "produto";
          } else {
            waTarget = "flutuante";
          }
        }
        push("whatsapp_click", { target: waTarget });
      }
    },
    true,
  );

  // Um evento por campo focado (nao so o primeiro): a jornada mostra
  // "Campo focado" como no painel. Continua sendo `form_open` para o funil
  // contar a sessao que comecou a preencher.
  document.addEventListener(
    "focusin",
    function (evt) {
      var el = evt.target;
      if (!(el instanceof Element) || !el.closest("form") || !el.matches("input, textarea, select")) return;
      once("form-" + (el.getAttribute("name") || el.id || fieldLabel(el)), "form_open", { target: fieldLabel(el) });
    },
    true,
  );

  document.addEventListener(
    "submit",
    function (evt) {
      var form = evt.target;
      if (form instanceof Element && form.matches("form[data-lead-form]")) return;
      push("form_submit", {
        target: (form instanceof Element && (form.getAttribute("data-track") || form.id)) || "",
      });
    },
    true,
  );

  window.addEventListener(
    "scroll",
    function () {
      var doc = document.documentElement;
      var rolavel = doc.scrollHeight - window.innerHeight;
      if (rolavel <= 0) return;
      var pct = (window.scrollY / rolavel) * 100;
      [25, 50, 75, 100].forEach(function (marco) {
        if (pct >= marco) once("scroll-" + marco, "scroll", { target: marco + "% da página" });
      });
    },
    { passive: true },
  );

  // Permanencia = tempo de aba VISIVEL, nao relogio de parede: aba de fundo
  // esquecida aberta inflaria a metrica sem ninguem ler nada.
  //
  // Cada evento leva o DELTA desde o ultimo envio, nunca o acumulado: assim o
  // painel soma as linhas da sessao e chega no tempo total sem precisar
  // deduplicar reentradas na aba nem paginas diferentes da mesma visita.
  function pushDwell(pagina) {
    visibleMs += Date.now() - lastShownAt;
    lastShownAt = Date.now();
    // `pagina` so vem da troca de rota: o tempo e da pagina que saiu, nao da que entra.
    if (visibleMs >= 1000) {
      push("engagement", { dwell_ms: visibleMs, page: (pagina || location.pathname).slice(0, 255) });
    }
    visibleMs = 0;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      pushDwell();
      flush(true);
    } else {
      lastShownAt = Date.now();
    }
  });

  window.addEventListener("pagehide", function () {
    if (document.visibilityState !== "hidden") pushDwell();
    flush(true);
  });

  // Gancho pro app marcar o que o DOM nao denuncia sozinho.
  var trackFn = function (event, target) {
    push(event, { target: String(target || "").slice(0, 200) });
  };
  window.talimpoTrack = trackFn;
  window.auTrack = trackFn;

  // O formulário drena a fila no mesmo request do contato: assim os eventos
  // anteriores e o marcador `lead:<id>` chegam juntos, sem associação por IP.
  var leadTrackingObj = {
    takeContactContext: function () {
      var currentSession = session();
      var origin = attribution();
      var touch = origin.last_touch || {};
      return {
        session_id: currentSession.id,
        attribution_id: origin.attribution_id,
        page: location.pathname.slice(0, 255),
        referrer: touch.referrer_host || "",
        utm_source: touch.source || "",
        utm_medium: touch.medium || "",
        utm_campaign: touch.campaign || "",
        utm_term: touch.term || "",
        utm_content: touch.content || "",
        placement: touch.placement || "",
        first_touch: origin.first_touch,
        last_touch: origin.last_touch,
        device: device(),
        occurred_at: new Date().toISOString(),
        events: queue.splice(0, 50),
      };
    },
  };
  window.talimpoLeadTracking = leadTrackingObj;
  window.auLeadTracking = leadTrackingObj;
})();
