const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();

// Autenticar usando o código QR
client.on('qr', (qrCode, scanStatus) => {
    qrcode.generate(qrCode, { small: true }); // Renderizar o código QR no terminal
    console.log('Escaneie o código QR com o seu aplicativo WhatsApp:');
});

// Evento de autenticação bem-sucedida
client.on('authenticated', (session) => {
    console.log('Autenticado no WhatsApp.');
    startListening(); // Iniciar o servidor após a autenticação
});

// Inicializar o cliente do WhatsApp
client.initialize();

// Iniciar o servidor
function startListening() {
    app.post('/payload', (req, res) => {
        const { commits } = req.body;

        if (commits && commits.length > 0) {
            const commit = commits[0];
            const commitMessage = commit.message;
            const commitAuthor = commit.author.username;
            const commitURL = commit.url;
            const commitDate = new Date(commit.timestamp).toLocaleString(); // Obter a data formatada
            const repoName = getRepoNameFromCommitURL(commitURL);

            // Verificar o nome do repositório e definir o ID do grupo correspondente
            let groupID;
            if (repoName === 'api-allstack') {
                groupID = '120363129757303262@g.us';
            } else if (repoName === 'frontend') {
                groupID = '120363148607141306@g.us';
            }

            // Enviar a mensagem para o grupo específico no WhatsApp
            const message = `Novo commit no repo "${repoName}":\n\nNome: ${commitMessage}\nUsuário: ${commitAuthor}\nURL: ${commitURL}\nData: ${commitDate}`;

            client.sendMessage(groupID, message)
                .then(() => {
                    console.log('Mensagem enviada com sucesso!');
                })
                .catch((error) => {
                    console.error('Erro ao enviar a mensagem:', error);
                });
        }

        res.sendStatus(200);
    });

    // Ouvinte de eventos para mensagens recebidas
    client.on('message_create', async (message) => {
        const { body, from } = message;

        // Verificar se a mensagem começa com o sufixo "$asb"
        if (body.startsWith('$asb')) {
            // Enviar uma reação com um emoji de check verde
            const chat = await message.getChat();
            chat.sendSeen();
            message.react('🟢');
        }
    });

    // Enviar a mensagem de boas-vindas ao grupo específico no WhatsApp
    client.on('ready', () => {
        const groupID = '120363148607141306@g.us';
        const message = 'Estou pronto e ouvindo. No que posso ajudar?';

        client.sendMessage(groupID, message)
            .then(() => {
                console.log('Mensagem de boas-vindas enviada com sucesso!');
            })
            .catch((error) => {
                console.error('Erro ao enviar a mensagem de boas-vindas:', error);
            });
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

