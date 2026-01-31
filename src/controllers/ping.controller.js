exports.ping = (req, res) => {
  res.json({ ok: true, ts: Date.now() });
};
