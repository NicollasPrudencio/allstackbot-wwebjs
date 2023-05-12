const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();

// Armazenar as relações entre repositórios e grupos
const repositoryGroups = {};

// ID do grupo para perguntar qual grupo relacionar
const questionGroupID = '120363130640232555@g.us';

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

            // Verificar se o repositório está mapeado para um grupo
            if (repositoryGroups.hasOwnProperty(repoName)) {
                const groupID = repositoryGroups[repoName];

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
                console.log(`Nenhum grupo definido para o repositório "${repoName}".`);
                askForGroupID(repoName);
            }
        }

        res.sendStatus(200);
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

// Função para relacionar um repositório a um grupo do WhatsApp
function addRepositoryGroup(repoName, groupID) {
    repositoryGroups[repoName] = groupID;
    console.log(`Repositório "${repoName}" relacionado ao grupo "${groupID}".`);
}

// Função para obter o nome do repositório a partir da URL de commit
function getRepoNameFromCommitURL(commitURL) {
    const regex = /https:\/\/github.com\/.+?\/(.+?)\/commit\/.+/;
    const match = commitURL.match(regex);
    return match ? match[1] : null;
}

// Função para perguntar o ID do grupo para relacionar um novo repositório
function askForGroupID(repoName) {
    const message = `Qual é o ID do grupo do WhatsApp que deseja relacionar com o repositório "${repoName}"? Responda com "$asb <ID do grupo>".`;

    client.sendMessage(questionGroupID, message)
        .then(() => {
            console.log(`Pergunta enviada para o grupo "${questionGroupID}"`);
        })
        .catch((error) => {
            console.error('Erro ao enviar a pergunta:', error);
        });
}

// Evento para receber as mensagens e verificar a resposta com o ID do grupo
client.on('message', async (message) => {
    if (message.body.startsWith('$asb ')) {
        const groupID = message.body.substring(5); // Extrair o ID do grupo da mensagem
        const repoName = repositoryToBeRelated;

        // Salvar a relação entre o repositório e o grupo
        addRepositoryGroup(repoName, groupID);

        const confirmationMessage = `Repositório "${repoName}" relacionado ao grupo "${groupID}"`;
        client.sendMessage(questionGroupID, confirmationMessage)
            .then(() => {
                console.log('Confirmação enviada com sucesso!');
            })
            .catch((error) => {
                console.error('Erro ao enviar a confirmação:', error);
            });
    }
});
