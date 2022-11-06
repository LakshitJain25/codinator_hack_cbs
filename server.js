require('dotenv').config()
const express = require('express')
const path = require('path')
const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs')
const { spawn } = require('child_process')
const { auth, requiresAuth } = require('express-openid-connect');

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

app.use(
    auth({
      authRequired: false,
      auth0Logout: true,
      issuerBaseURL: process.env.ISSUER_BASE_URL,
      baseURL: process.env.BASE_URL,
      clientID: process.env.CLIENT_ID,
      secret: process.env.SECRET,
      idpLogout: true,
    })
  );



const configuration = new Configuration({
    apiKey: process.env.OPENAI_API,
});

const openai = new OpenAIApi(configuration);


const fileTypesToExtension = {
    'python': 'py',
    'javascript': 'js'
}

const createUserFile = fileObj => {
    const uniqueFileName = fileObj.language + "_" + Date.now() + '-' + Math.round(Math.random() * 1E9) + "." + fileTypesToExtension[fileObj.language]

    const filePath = path.join(__dirname, 'uploads', uniqueFileName)

    fs.writeFileSync(filePath, fileObj.code)
    return filePath.toString()
}

app.post('/code/exec', (req, res) => {
    const submissionLang = req.body.language

    const filePath = createUserFile(req.body)
    console.log(`Created file ${filePath}`)

    switch (submissionLang) {
        case 'python':
            const python = spawn('python', [filePath])
            let output = ""
            python.stdout.on('data', data => {
                output += data
            })

            python.on('exit', () => {
                console.log(output)
                res.status(200).json({ output })
            })

            break

        case 'javascript':
        default:
            res.status(400).json({ error: 'Invalid language' })
    }
})


app.post('/code/write', async (req, res) => {
    const text = req.body.code
    const outputCode = await openai.createCompletion("text-davinci-001", {
        prompt: `Write code by following these instructions:\n${text}`,
        max_tokens: 500,
        temperature: 0.2,
    }).then(response => {
        if (!response) throw Error;

        console.log("Wrote: ", response.data.choices[0].text)
        res.status(200)
        res.send(response.data)
    })
        .then(undefined, err => {
            console.error('I am error', err);
        });

})

app.post('/code/convert', async (req, res) => {
    const text = req.body.code
    const outputCode = await openai.createCompletion("text-davinci-001", {
        prompt: `Convert this piece of code from ${text}`,
        max_tokens: 500,
        temperature: 0.2,
    }).then(response => {
        if (!response) throw Error;

        console.log("Converted: ", response.data.choices[0].text)
        res.status(200)
        res.send(response.data)
    })
        .then(undefined, err => {
            console.error('I am error', err);
        });
})


app.get('/profile', requiresAuth(), (req, res) => {
    res.send(`hello ${req.oidc.user.name}`);
});

app.get('/auth', (req, res) => {
    console.log("CHECKING")
    res.send(req.oidc.isAuthenticated())
})

app.get('/playground', requiresAuth(), (req,res) => {
    res.redirect('/assets/playground.html');
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})