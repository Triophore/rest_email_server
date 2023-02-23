require('dotenv').config()
var models = {};

const SMTPServer = require("smtp-server").SMTPServer;
const parser = require("mailparser").simpleParser

var rotatingLogStream = require('file-stream-rotator').getStream(
    { 
        filename: "log/MAIL-%DATE%.log", 
        frequency: "daily", 
        verbose: true,
        size:'100m',
        max_logs:2,
        audit_file:"log/audit/mail.json" 
    }
);

function LTS(data) {
    rotatingLogStream.write( Date.now() +"::"+ data + "\n")
}



const log = LTS

    const server = new SMTPServer({
        onData(stream, session, callback) {
          parser(stream, {}, (err, parsed) => {
            if (err)
            log("Error:" , err)
            log(JSON.stringify(parsed))
            stream.on("end", callback)
          })
          
        },
        disabledCommands: ['AUTH']
      });
      
  server.listen(process.env.MAILSERVER_PORT,process.env.MAILSERVER_HOST);
