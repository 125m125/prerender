// Prometheus metrics plugin for prerender
const client = require('prom-client');
client.collectDefaultMetrics();

// Metrics
const activePrerenders = new client.Gauge({
  name: 'prerender_active_requests',
  help: 'Number of active prerender requests',
});
const prerenderTotalDuration = new client.Histogram({
  name: 'prerender_requests_duration_seconds',
  help: 'Total prerender duration in seconds',
  labelNames: ['status_code', 'render_type'],
  buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 30],
});
const prerenderRenderedBytes = new client.Counter({
  name: 'prerender_rendered_bytes_total',
  help: 'Total prerender rendered bytes',
  labelNames: ['status_code', 'render_type'],
});
const prerenderPhaseSeconds = new client.Summary({
  name: 'prerender_phase_seconds',
  help: 'Total time spent in prerender phases (seconds)',
  labelNames: ['phase', 'status_code', 'render_type'],
  percentiles: [],
});

module.exports = {
  init(server) {
    // Reset metrics on startup
    activePrerenders.set(0);
  },
  processRequest(req, res) {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', client.register.contentType);
      client.register.metrics().then((metrics) => {
        res.end(metrics);
      });
      return true;
    }
    return false;
  },
  requestReceived(req, res, next) {
    activePrerenders.inc();
    next();
  },
  beforeSend(req, res, next) {
    activePrerenders.dec();
    if (req.prerender) {
      const code =
        req.prerender && req.prerender.statusCode
          ? String(req.prerender.statusCode)
          : 'unknown';
      const renderType =
        req.prerender && req.prerender.renderType
          ? String(req.prerender.renderType)
          : 'html';
      const totalMs =
        (req.prerender.timeSpentConnectingToBrowser ?? 0) +
        (req.prerender.timeSpentOpeningTab ?? 0) +
        (req.prerender.timeSpentLoadingUrl ?? 0) +
        (req.prerender.timeSpentParsingPage ?? 0);
      if (totalMs > 0) {
        prerenderTotalDuration.observe(
          { status_code: code, render_type: renderType },
          totalMs / 1000,
        );
      }
      if (req.prerender.content) {
        prerenderRenderedBytes.inc(
          { status_code: code, render_type: renderType },
          Buffer.byteLength(req.prerender.content),
        );
      }
      [
        'timeSpentConnectingToBrowser',
        'timeSpentOpeningTab',
        'timeSpentLoadingUrl',
        'timeSpentParsingPage',
        'timeUntilError',
      ].forEach((phase) => {
        const val = req.prerender[phase];
        if (typeof val === 'number' && val > 0) {
          prerenderPhaseSeconds.observe(
            { phase, status_code: code, render_type: renderType },
            val / 1000,
          );
        }
      });
    }
    next();
  },
};
