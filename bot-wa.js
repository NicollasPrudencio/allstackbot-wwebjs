const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();

// Armazenar as decisões de mapeamento entre repositórios e IDs de grupo
const repositoryGroups = {};

// ID do grupo para solicitar o ID do grupo relacionado ao repositório
const askGroupId = '120363130640232555@g.us';

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
        const { commits, repository } = req.body;

        if (commits && commits.length > 0) {
            const commit = commits[0];
            const commitMessage = commit.message;
            const commitAuthor = commit.author.username;
            const commitURL = commit.url;
            const commitDate = new Date(commit.timestamp).toLocaleString(); // Obter a data formatada

            // Verificar se o repositório já tem um ID de grupo associado
            if (repositoryGroups.hasOwnProperty(repository)) {
                const groupID = repositoryGroups[repository];
                const message = `Novo commit no repo ${repository}:\n\nNome: ${commitMessage}\nUsuário: ${commitAuthor}\nURL: ${commitURL}\nData: ${commitDate}`;

                client.sendMessage(groupID, message)
                    .then(() => {
                        console.log('Mensagem enviada com sucesso!');
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem:', error);
                    });
            } else {
                // Verificar se o repositório tem um grupo definido no momento
                if (!groupToAsk(repository)) {
                    console.log('Nenhum grupo definido para o repositório', repository);
                    res.sendStatus(200);
                    return;
                }

                askGroupRelationship(repository, askGroupId);
            }
        }

        res.sendStatus(200);
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

// Verificar se o repositório deve solicitar um grupo para estabelecer a relação
function groupToAsk(repository) {
    return !repositoryGroups[repository];
}

// Função para solicitar o ID do grupo para estabelecer a relação
function askGroupRelationship(repository, groupID) {
    const message = `Um novo commit foi recebido pelo bot do Projeto All Stack, com o nome "${repository}". Por favor, informe o ID do grupo que será enviado as notificações:`;

    client.sendMessage(groupID, message)
        .then(() => {
            // Aguardar qualquer resposta
            client.on('message', async (msg) => {
                // Verificar se a mensagem começa com o comando "$asb"
                if (msg.body.startsWith('$asb ')) {
                    const newGroupID = msg.body.split('$asb ')[1];

                    // Estabelecer a relação entre o repositório e o novo grupo
                    repositoryGroups[repository] = newGroupID;

                    const replyMessage = `A relação entre o repositório "${repository}" e o grupo "${newGroupID}" foi estabelecida com sucesso!`;
                    client.sendMessage(msg.from, replyMessage);
                    console.log(replyMessage);
                } else {
                    const replyMessage = 'Comando inválido. Responda com "$asb <id do grupo para relação>".';
                    client.sendMessage(msg.from, replyMessage);
                    console.log(replyMessage);
                }
            });
        })
        .catch((error) => {
            console.error('Erro ao enviar a mensagem:', error);
        });
}
