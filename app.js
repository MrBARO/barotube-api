const express = require("express"),
  app = express(),
  path = require("path"),
  passport = require("passport"),
  session = require("express-session"),
  LevelStore = require("level-session-store")(session),
  Strategy = require("passport-discord").Strategy,
  helmet = require("helmet"),
  fs = require("fs"),
  url = require("url"),
  bodyParser = require("body-parser"),
  ytdl = require("ytdl-core"),
  { Search } = require("./functions"),
  urlC = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/gi,
  Discord = require("discord.js");

const Spotify = require("node-spotify-api");
const spotify = new Spotify({
  id: "67f7d61440144dd1bf1f470f204d36b1",
  secret: "f77e429af148425192bab93e2c195bce"
});

module.exports = (client, webhookClient) => {
  const templateDir = path.resolve(`${process.cwd()}${path.sep}/page`);

  const render = (res, req, template, data = {}) => {
    const baseData = {
      path: req.path,
      user: req.isAuthenticated() ? req.user : null,
      client: client
    };
    res.render(
      path.resolve(`${templateDir}${path.sep}${template}`),
      Object.assign(baseData, data)
    );
  };

  app.use(express.static(path.join(__dirname, "public")));
  app.set("view engine", "ejs");

  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  passport.use(
    new Strategy(
      {
        clientID: client.user.id,
        clientSecret: client.config.oauthSecret,
        callbackURL: client.config.callbackURL,
        scope: ["identify"]
      },
      (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
      }
    )
  );

  app.use(
    session({
      secret: "123",
      resave: false,
      saveUninitialized: false
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(helmet());

  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );

  function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect("/login");
  }

  app.get(
    "/login",
    (req, res, next) => {
      if (req.session.backURL) {
        req.session.backURL = req.session.backURL;
      } else if (req.headers.referer) {
        const parsed = url.parse(req.headers.referer);
        if (parsed.hostname === app.locals.callbackURL) {
          req.session.backURL = parsed.path;
        }
      } else {
        req.session.backURL = "/";
      }
      next();
    },
    passport.authenticate("discord")
  );

  app.get("/autherror", (req, res) => {
    render(res, req, "404");
  });

  app.get(
    "/callback",
    passport.authenticate("discord", { failureRedirect: "/autherror" }),
    async (req, res) => {
      if (req.session.backURL) {
        let url = req.session.backURL;
        req.session.backURL = null;
        res.redirect(url);
      } else {
        res.redirect("/");
      }
    }
  );

  app.get("/logout", function(req, res) {
    req.session.destroy(() => {
      req.logout();
      res.redirect("/");
    });
  });

  app.get("/", function(req, res) {
    render(res, req, "index");
    //res.redirect('https://www.npmjs.com/package/barotube');
  });

  app.get("/getkey", checkAuth, function(req, res) {
    render(res, req, "key");
  });
  app.post("/getkey", checkAuth, function(req, res) {
    let body = req.body;
    if (client.data.find(val => val.status === `verified_${req.user.id}`))
      return render(res, req, "key");
    if (client.data.find(val => val.status === `waiting_${req.user.id}`))
      return render(res, req, "key");

    var { generate } = require("generate-password");
    var key = generate({
      length: 50,
      numbers: true,
      uppercase: true,
      excludeSimilarCharacters: false,
      strict: true,
      symbols: false
    });

    let db = {
      email: body["email"],
      using_purpose: body["message"],
      key: key,
      status: `waiting_${req.user.id}`
    };

    client.data.set(key, db);

    client.channels.cache
      .get("896031183337578526")
      .send(
        `${body["name"]} \n${body["email"]} \n${
          body["message"]
        } \n${key} \n\n.verified ${body["email"]} ${body["message"]} verified_${
          req.user.id
        } ${key}`
      );
    render(res, req, "key");
  });

  app.get("/ab", async function(req, res) {
    let arr = [
      {
        heroku: "sa"
      }
    ];

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(arr, null, 3));
  });

  /*
    
    YouTube Video
    
  */

  app.post("/videos", async function(req, res) {
    let { v, key } = req.body;
    if (!client.data.find(val => val.key === key))
      return res.status(401).send({
        error:
          "Make sure you enter a valid API key or API key. For API key: https://barotube.cf"
      });

    let aaa = client.data.find(val => val.key === key);
    let embed = new Discord.MessageEmbed()
      .setTitle(v)
      .addField("Email", aaa.email)
      .addField("Amacı", aaa.using_purpose);
    webhookClient.send("Video Search", {
      username: "BaroTube - LOG",
      embeds: [embed]
    });

    if (!v)
      return res.status(401).send({
        error: "Enter a valid YouTube URL or a video title."
      });

    if (urlC.test(v)) {
      let sInfo = await ytdl.getInfo(v);
      let durationMs = Number(sInfo.videoDetails.lengthSeconds) * 1000;

      let song = [
        {
          title: sInfo.videoDetails.title,
          url: `${v}`,
          duration: await msToTime(durationMs),
          durationMs: durationMs,
          thumbnail: `https://i.ytimg.com/vi/${sInfo.videoDetails.videoId}/maxresdefault.jpg`
        }
      ];
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(song, null, 3));
      return;
    }

    v = await Search(v);
    if (v.length <= 0)
      return res.status(401).send({ error: "There were no results." });

    let arr = [];
    v.forEach(async data => {
      let durationMs = Number(data.seconds) * 1000;
      let duration;

      function bruh(num) {
        return String(num).length == 1 ? `0${num}` : num;
      }
      let seconds = durationMs / 1000;
      let hours = parseInt(seconds / 3600);
      seconds = seconds % 3600;
      let minutes = parseInt(seconds / 60);
      seconds = seconds % 60;

      if (hours !== 0) {
        duration =
          bruh(Math.floor(hours)) +
          ":" +
          bruh(Math.floor(minutes)) +
          ":" +
          bruh(Math.floor(seconds));
      } else {
        duration = bruh(Math.floor(minutes)) + ":" + bruh(Math.floor(seconds));
      }

      arr.push({
        title: data.title,
        videoId: data.videoId,
        url: data.url,
        duration: duration,
        durationMs: durationMs,
        views: data.views,
        author: {
          name: data.author.name,
          url: data.author.url
        },
        thumbnail: `https://i.ytimg.com/vi/${data.videoId}/maxresdefault.jpg`
      });
    });

    console.log(arr);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(arr, null, 3));
  });

  /*
    
    YouTube Playlist
    
  */

  app.post("/playlist", async function(req, res) {
    const ytpl = require("ytpl");
    const { v, key } = req.body;
    if (!client.data.find(val => val.key === key))
      return res.status(401).send({
        error:
          "Make sure you enter a valid API key or API key. For API key: https://barotube.cf"
      });
    let aaa = await client.data.find(val => val.key === key);
    let embed = new Discord.MessageEmbed().setTitle(v).setDescription(aaa);

    webhookClient.send("PlayList Search", {
      username: "BaroTube - LOG",
      embeds: [embed]
    });

    if (!v)
      return res.status(401).send({ error: "Enter a valid playlist URL." });

    const playlistPattern = /^.*(youtu.be\/|list=)([^#\&\?]*).*/gi;

    let urlArr = v.split("=").pop();
    console.log(urlArr);
    try {
      const data = await ytpl(urlArr);
      let songs = [];
      let filter = data.items.filter(p => p.title !== "[Private video]");

      filter.forEach(async video => {
        let h, m, s, durationMs;
        let duration = video.duration;
        duration = duration.split(":");
        if (duration.length == 3) {
          h = Number(duration[0]) * 3600000;
          m = Number(duration[1]) * 60000;
          s = Number(duration[2]) * 1000;
          durationMs = h + m + s;
        } else {
          m = Number(duration[0]) * 60000;
          s = Number(duration[1]) * 1000;
          durationMs = m + s;
        }
        function bruh(num) {
          return String(num).length == 1 ? `0${num}` : num;
        }
        let seconds = durationMs / 1000;
        let hours = parseInt(seconds / 3600);
        seconds = seconds % 3600;
        let minutes = parseInt(seconds / 60);
        seconds = seconds % 60;
        if (hours !== 0) {
          duration =
            bruh(Math.floor(hours)) +
            ":" +
            bruh(Math.floor(minutes)) +
            ":" +
            bruh(Math.floor(seconds));
        } else {
          duration =
            bruh(Math.floor(minutes)) + ":" + bruh(Math.floor(seconds));
        }
        songs.push({
          title: video.title,
          url: video.url_simple,
          author: {
            name: data.author.name,
            channel_url: data.author.channel_url
          },
          duration: duration,
          durationMs: Number(durationMs),
          thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`
        });
      });
      let arr = {
        id: data.id,
        url: data.url,
        title: data.title,
        videos_size: songs.length,
        views: data.views,
        last_updated: data.last_updated,
        author: {
          id: data.author.id,
          name: data.author.name,
          avatar: data.author.avatar,
          url: data.author.channel_url
        },
        videos: songs
      };

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(arr, null, 3));
    } catch (err) {
      if (!playlistPattern.test(v))
        return res
          .status(401)
          .send({ error: "You can only enter the playlist URL." });
      if (
        String(err)
          .split(" ")
          .pop() === "exist."
      )
        return res.status(401).send({ error: "The playlist is hidden." });
      if (
        String(err)
          .split(" ")
          .pop() === "undefined"
      )
        return res.status(401).send({ error: "Invalid playlist." });
    }
  });

  app.get("*", async function(req, res) {
    render(res, req, "404");
  });

  app.listen(3000);
};


async function msToTime(durationMs) {
  function bruh(num) {
    return String(num).length == 1 ? `0${num}` : num;
  }
  function msToTimee(ms) {
    let seconds = ms / 1000;
    let hours = parseInt(seconds / 3600);
    seconds = seconds % 3600;
    let minutes = parseInt(seconds / 60);
    seconds = seconds % 60;

    if (hours !== 0) {
      return (
        bruh(Math.floor(hours)) +
        ":" +
        bruh(Math.floor(minutes)) +
        ":" +
        bruh(Math.floor(seconds))
      );
    } else {
      return bruh(Math.floor(minutes)) + ":" + bruh(Math.floor(seconds));
    }
  }
  return msToTimee(durationMs);
}
