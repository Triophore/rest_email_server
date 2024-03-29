require('dotenv').config()
var models = {};

const SMTPServer = require("smtp-server").SMTPServer;
const parser = require("mailparser").simpleParser
var MongoClient = require('mongodb').MongoClient;
const whitelist = require("./whitelist.json")

var rotatingLogStream = require('file-stream-rotator').getStream(
  {
    filename: "log/MAIL-%DATE%.log",
    frequency: "daily",
    verbose: true,
    size: '100m',
    max_logs: 2,
    audit_file: "log/audit/mail.json"
  }
);

function LTS(data) {
  rotatingLogStream.write(Date.now() + "::" + data + "\n")
}



const log = LTS

async function start() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_NATIVE, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    nativedb = client.db(process.env.MONGODB_DB);
    const server = new SMTPServer({
      options: {
        secure: false,
        name: "<server_name>",
        banner: "<server name banner>",
        hideSize: true,
        size: 1024 * 1024 * 2,

      },
      onMailFrom(address, session, callback) {
        if (whitelist.enable == false) {
          return callback();
        } else {
          var email_address = address.address.split("@");
          var email_domain = email_address[1];
          for (var i = 0; i < whitelist.domain.length; i++) {
            var domain = whitelist.domain[i];
            if (domain === email_domain) {
              return callback();
            }
          }
          return callback(
            new Error("This domain is not allowed to send mail")
          );
        }
      },
      onRcptTo(address, session, callback) {
        if (address.address.includes("@lifesignals.dev")) {
          return callback(
            new Error("Only lifesignals.dev is allowed to receive mail")
          );
        }
        return callback(); // Accept the address
      },
      onData(stream, session, callback) {
        parser(stream, {}, async (err, parsed) => {
          if (err) {
            log("Error:", err)
          } else {
            var to_arr = parsed.to.value[0].address.split("@");
            var from_arr = parsed.from.value[0].address.split("@");
            var data = {
              to_name: to_arr[0],
              to_full: to_arr[1],
              from_name: from_arr[0],
              from_full: from_arr[1],
              createdAt: Date.now(),
              ...parsed
            }
            
            var insert = await nativedb.collection("rest_email").insertOne(data);
            var webpacket = {
              to_name: to_arr[0],
              to_full: to_arr[1],
              from_name: from_arr[0],
              from_full: from_arr[1],
              createdAt: Date.now(),
              _id : insert.insertedId
            }
            await require("axios").post(process.env.WEBAPI,webpacket)
            log("--------------------")
            log(JSON.stringify(parsed))
            log("--------------------")
            log(JSON.stringify(insert))
            log("--------------------")
          }
        })
        stream.on('end', () => {
          let err;
          if (stream.sizeExceeded) {
              err = new Error('Error: message exceeds fixed maximum message size 10 MB');
              err.responseCode = 552;
              return callback(err);
          }
          callback(null, 'Message queued as abcdef'); // accept the message once the stream is ended
        });
      },
      disabledCommands: ['AUTH']
    });
    server.on("error", err => {
      log("SERROR");
      log(err.message)
      log("SERROR")
    });
    server.listen(process.env.MAILSERVER_PORT, process.env.MAILSERVER_HOST);
  } catch (error) {
    log("ERROR")
    log(error)
    log("ERROR")
  }
}

start();


