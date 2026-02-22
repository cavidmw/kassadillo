const { getChannelById } = require("./_lib/youtube");

module.exports = async function handler(req, res) {
  try {
    const { cid } = req.query;

    if (!cid) {
      return res.status(400).send("missing channel id");
    }

    // Youtube'dan kanal bilgisi al
    const channel = await getChannelById(cid);

    if (!channel || !channel.snippet || !channel.snippet.thumbnails) {
      return res.status(404).send("avatar not available");
    }

    const thumbs = channel.snippet.thumbnails;

    // En iyi kaliteden başlayarak sırayla dene
    const avatarUrl =
      thumbs.maxres?.url ||
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url;

    if (!avatarUrl) {
      return res.status(404).send("avatar not available");
    }

    // Resmi fetch et
    const imgRes = await fetch(avatarUrl);
    const buffer = await imgRes.arrayBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error("avatar error:", err);
    res.status(500).send("avatar error");
  }
};