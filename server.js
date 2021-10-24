var fetch = require("node-fetch");

const Enmap = require("enmap");
const Discord = require("discord.js");
const client = new Discord.Client();
const webhookClient = new Discord.WebhookClient(
  "756585399572365363",
  "oDV2DQ7bUCE44QkiZFNBvNolutJVwrWgfc10MfMerx48f2ZjAuSCFND0KJkKig_QKe-D"
);

client.on("ready", async () => {
  require("./app.js")(client, webhookClient);
  //client.data.destroy()
  console.log("ready", client.data);
});

client.config = {
  oauthSecret: "SaMGLJ6TANzoLItSEdkvWZKDiMjgLAbz",
  sessionSecret: "xyzxyz",
  callbackURL: "https://www.barotube.cf/callback"
};

client.data = new Enmap({
  name: "data"
});

async function clean(text) {
  if (typeof text === "string")
    return text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203));
  else if (text && text.constructor.name == "Promise") text = await text;
  else return text;
}
let prefix = ".";

client.on("message", async message => {
  if (message.author.id === "443456237623967744") {
    const args = message.content.split(" ").slice(1);

    if (message.content.startsWith(prefix + "eval")) {
      try {
        const code = args.join(" ");
        let evaled = eval(code);

        if (typeof evaled !== "string")
          evaled = require("util").inspect(evaled);
        if (evaled && evaled.constructor.name == "Promise")
          evaled = await evaled;

        message.channel.send(await clean(evaled), { code: "js" });
      } catch (err) {
        message.channel.send(`\`err\` \`\`\`xl\n${clean(err)}\n\`\`\``);
      }
    }
    if (message.content.startsWith(prefix + "verified")) {
      var nodemailer = require("nodemailer");

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "barotubenpm@gmail.com",
          pass: "905240Gs1905+"
        }
      });

      var mailOptions = {
        from: "barotubenpm@gmail.com",
        to: args.join(" "),
        subject: "Verified!",
        html: `<p>Here is your API key! Please use with caution and do not share. If it is detected that you have shared it, your key will be reset.<p> <br><br><bold>API key<bold>: ${client.data.get(args.join(" "))}`
      };

      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent: " + info.response);
          let db = {
            email: args[0],
            using_purpose: args[1],
            key: args[3],
            status: args[2]
          };
          client.data.set(args[3], db);
        }
      });
    }
  }
});

setInterval(async () => {
  let sa = await fetch("https://barisdonmez.glitch.me/api").then(a => a.json());
  console.log(sa);
}, 240000);

client.login(process.env.TOKEN);
