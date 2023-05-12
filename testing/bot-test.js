const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();
const mainGroupID = '120363092460966035@g.us'; // ID do grupo principal
const commands = [
    { name: 'comandos', status: 'active' },
    { name: 'ajuda', status: 'inactive' },
    { name: 'saudacao', status: 'inactive' },
    { name: 'ignorar', status: 'active' },
    { name: 'ignorar repo', status: 'active' }
];

// Memória para armazenar atributos e valores
const memory = {
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
            const commitDate = new Date(commit.timestamp).toLocaleString();
            const repoName = getRepoNameFromCommitURL(commitURL);

            let groupID = memory[repoName];

            if (!groupID) {
                const helpMessage = `Preciso de ajuda! Recebi demandas do repositório do Github chamado "${repoName}". Qual grupo da squad que ele pertence?`;
                client.sendMessage(mainGroupID, helpMessage)
                    .then(() => {
                        console.log('Mensagem de ajuda enviada com sucesso!');
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem de ajuda:', error);
                    });

                res.sendStatus(200);
                return;
            }

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

        if (body.startsWith('$asb')) {
            const chat = await message.getChat();
            if (chat.isGroup && chat.id._serialized === mainGroupID) {
                const command = body.split(' ')[1];
                if (command === 'comandos') {
                    const activeCommands = commands
                        .filter((cmd) => cmd.status === 'active')
                        .map((cmd) => cmd.name)
                        .join('\n');
                    const response = `Comandos ativos:\n\n${activeCommands}`;

                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem com comandos enviada com sucesso!');
                            message.react('🟢'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem com comandos:', error);
                            message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                } else if (command === 'ignorar') {
                    const repoName = body.split(' ')[2];
                    if (repoName) {
                        memory[repoName] = ''; // Limpar o valor do grupo para ignorar as notificações
                        const response = `Requisições do repositório "${repoName}" serão ignoradas.`;
                        client.sendMessage(mainGroupID, response)
                            .then(() => {
                                console.log('Mensagem de ignorar enviada com sucesso!');
                                message.react('🟢'); // Reagir com o emoji verde quando o comando é reconhecido
                            })
                            .catch((error) => {
                                console.error('Erro ao enviar a mensagem de ignorar:', error);
                                message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                            });
                    } else {
                        const response = 'Comando inválido. Você deve fornecer o nome do repositório para ignorar.';
                        client.sendMessage(mainGroupID, response)
                            .then(() => {
                                console.log('Mensagem de comando inválido enviada com sucesso!');
                                message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                            })
                            .catch((error) => {
                                console.error('Erro ao enviar a mensagem de comando inválido:', error);
                                message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                            });
                    }
                } else if (command === 'ignorar repo') {
                    memory = {}; // Limpar toda a memória
                    const response = 'Todas as requisições do bot serão ignoradas.';
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem de ignorar tudo enviada com sucesso!');
                            message.react('🟢'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                            message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                } else {
                    // Outra instrução ou comando não reconhecido
                    chat.sendSeen();
                    message.react('🔴'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                }
            }
        }
    });

    // Enviar a mensagem de boas-vindas ao grupo específico no WhatsApp
    client.on('ready', () => {
        const message = 'Estou pronto e ouvindo. No que posso ajudar?';

        client.sendMessage(mainGroupID, message)
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

// Função para obter o nome do repositório a partir da URL do commit
function getRepoNameFromCommitURL(commitURL) {
    const repoNameStartIndex = commitURL.indexOf('github.com/') + 11;
    const repoNameEndIndex = commitURL.indexOf('/', repoNameStartIndex);
    const repoName = commitURL.substring(repoNameStartIndex, repoNameEndIndex);
    return repoName;
}