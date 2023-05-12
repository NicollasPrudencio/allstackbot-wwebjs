const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();

// Memória do bot para armazenar a relação entre repositório e grupo
const repoGroupMap = {
    'api-allstack': '120363129757303262@g.us',
    'frontend': '120363148607141306@g.us'
};

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

            // Verificar se o repositório está na memória
            if (repoGroupMap.hasOwnProperty(repoName)) {
                const groupID = repoGroupMap[repoName];

                // Enviar a mensagem para o grupo específico no WhatsApp
                const message = `Novo commit no repo "${repoName}":\n\nNome: ${commitMessage}\nUsuário: ${commitAuthor}\nURL: ${commitURL}\nData: ${commitDate}`;

                client.sendMessage(groupID, message)
                    .then(() => {
                        console.log('Mensagem enviada com sucesso!');
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem:', error);
                    });
            } else {
                // Repositório desconhecido, preparar notificação para configuração
                const notificationMessage = `Recebi uma requisição do repo chamado ${repoName}. Qual grupo devo relacioná-lo?`;

                // Enviar a mensagem de notificação para o grupo específico no WhatsApp
                const groupID = '120363148607141306@g.us';
                client.sendMessage(groupID, notificationMessage)
                    .then(() => {
                        console.log('Notificação de configuração enviada com sucesso!');
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a notificação de configuração:', error);
                    });
            }
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

            // Extrair o ID do grupo da mensagem
            const groupID = body.split('$asb ')[1];

            // Verificar se o grupo é válido
            if (groupID) {
                const repoName = getRepoNameFromCommitURL(commitURL);

                // Adicionar o repositório e o grupo na memória
                repoGroupMap[repoName] = groupID;

                // Enviar a mensagem de confirmação
                const confirmationMessage = 'Obrigado, fiz a relação correta e agora reconheço este repo para enviar notificações de commit no grupo informado.';
                client.sendMessage(from, confirmationMessage)
                    .then(() => {
                        console.log('Mensagem de confirmação enviada com sucesso!');
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem de confirmação:', error);
                    });
            }
        }
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}
