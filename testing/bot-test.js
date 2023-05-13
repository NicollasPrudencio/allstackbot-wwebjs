const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

app.use(express.json());

// Configurar o cliente do WhatsApp
const client = new Client();
const mainGroupID = '555195660801-1424668624@g.us'; //'120363092460966035@g.us'; // ID do grupo principal
const commands = [
    { name: 'comandos', status: 'active' },
    { name: 'ignorar', status: 'active' },
    { name: 'ignorar_repo', status: 'active' },
    { name: 'informarid', status: 'active' },
    { name: 'qualid', status: 'active' },
    { name: 'ajuda', status: 'inactive' }
];

// Memória para armazenar atributos e valores
const memory = {
    main: {
        'api-allstack': '120363129757303262@g.us',
        'frontend': '120363148607141306@g.us'
    },
    pending: {},
    blacklist: []
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
    // escutando a rota /payload
    app.post('/payload', (req, res) => {
        const { commits } = req.body;
        if (commits && commits.length > 0) {
            const commit = commits[0];
            const commitMessage = commit.message;
            const commitAuthor = commit.author.username;
            const commitURL = commit.url;
            const commitDate = new Date(commit.timestamp).toLocaleString();
            const repoName = getRepoNameFromCommitURL(commitURL);

            let groupID = memory.main[repoName]; // armazena o nome do repo recebido na variavel, nao armazenará nada se não houver
            if (!groupID) { // se nao houver, ira colocar na fila de pendencia e solicitar id do grupo
                memory.pending[repoName] = true; // Definir status de pendente para o repositório não identificado
                const helpMessage = `Recebido demandas de um novo repositório do Github chamado "${repoName}". Qual grupo deseja receber notificações de commit deste repo?`;
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
        }
        const message = `Novo commit no repo "${repoName}":\n\nNome: ${commitMessage}\nUsuário: ${commitAuthor}\nURL: ${commitURL}\nData: ${commitDate}`;
        client.sendMessage(groupID, message)
            .then(() => {
                console.log('Mensagem enviada com sucesso!');
            })
            .catch((error) => {
                console.error('Erro ao enviar a mensagem:', error);
            });

        res.sendStatus(200);
    })
};

// Ouvinte de eventos para mensagens recebidas
client.on('message_create', async (message) => {
    const { body, from, to } = message;
    const chat = await message.getChat();
    console.log("Corpo msg: ", body);
    console.log("message: ", message);

    if (from && body.startsWith('$asb') && chat.isGroup && chat.id._serialized === mainGroupID) {
        const command = body.split(' ');
        if(command.length === 4){
            const repoName = body.split(' ')[2];
            const idGroup = body.split(' ')[3];
            const validacao = validacaoInformarID(repoName, idGroup);
        }

        console.log("Msg dividida para pegar comando: ", command);
        if (chat.isGroup && chat.id._serialized === mainGroupID) {
            // sufixo "$asb" para invocar o bot
            if (command === 'comandos') {
                const activeCommands = commands
                    .filter((cmd) => cmd.status === 'active')
                    .map((cmd) => cmd.name)
                    .join('\n');
                const response = `Comandos ativos:\n\n${activeCommands}`;
                client.sendMessage(mainGroupID, response)
                    .then(() => {
                        console.log('Mensagem com comandos enviada com sucesso!');
                        message.react('\u{2705}'); // Reagir com o emoji verde quando o comando é reconhecido
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem com comandos:', error);
                        message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                    });
            } else if (command === 'ignorar') { // se comando for ignorar
                const repoName = body.split(' ')[2]; // pega o parametro (nome do repo para ignorar)
                if (repoName) {
                    const response = `Requisição do repositório "${repoName}" foi ignorada.`;
                    memory.main[repoName] = ''; // Limpar o valor do grupo para ignorar a notificaçao
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem de ignorar enviada com sucesso!');
                            message.react('\u{2705}'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem de ignorar:', error);
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                } else {
                    const response = 'Comando inválido. Você deve fornecer o nome do repositório para ignorar esta requisição.';
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem de comando inválido enviada com sucesso!');
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem de comando inválido:', error);
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                }
            } else if (command === 'ignorar_repo') {
                const repoName = body.split(' ')[2];
                if (repoName !== undefined) {
                    memory.blacklist.push(repoName);
                    const response = `Todas as futuras requisições de ${repoName} ao bot serão ignoradas.`;
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem de ignorar todas as futuras requisições enviada com sucesso!');
                            message.react('\u{2705}'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                }
            } else if (command === 'informarid') {
                // $asb informarid repo idGrupo
                //coletar repo do parametro
                console.log(validacao);
                if (validacao === true) {
                    memory.main[repoName] = idGroup;    // Salvar a relação do grupo e repo na memoria do bot
                    memory.pending[repoName] = false;      // Tira o repo salvo na memoria das pendentes, pois foi informado um id
                    const response = `Todas as futuras requisições de ${repoName} ao bot serão ignoradas.`;
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem de ignorar todas as futuras requisições enviada com sucesso!');
                            message.react('\u{2705}'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                }
            } else if (validacao === 1) {
                const response = `O repositório ${repoName} já está salvo na memoria e já possui um grupo vinculado.`;
                client.sendMessage(mainGroupID, response)
                    .then(() => {
                        console.log('Mensagem de grupo já vinculado enviada com sucesso!');
                        message.react('\u{274C}'); // Reagir com o emoji verde quando o comando é reconhecido
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                        message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                    });
            } else if (validacao === 2) {
                const response = `O grupo id ${idGroup} informado é inválido. O formato correto é "XXXXXXXXXXXXXXXXXX@g.us".`;
                client.sendMessage(mainGroupID, response)
                    .then(() => {
                        console.log('Mensagem de grupo já vinculado enviada com sucesso!');
                        message.react('\u{274C}'); // Reagir com o emoji verde quando o comando é reconhecido
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                        message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                    });
            } else if (validacao === 3) {
                const response = `Parametros do comando "informarid" não informados. Use a sintaxe "$asb informarid nome_repo idgrupo".`;
                client.sendMessage(mainGroupID, response)
                    .then(() => {
                        console.log('Mensagem de parametros não informados enviada com sucesso!');
                        message.react('\u{274C}'); // Reagir com o emoji verde quando o comando é reconhecido
                    })
                    .catch((error) => {
                        console.error('Erro ao enviar a mensagem de ignorar tudo:', error);
                        message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                    });
            } else {
                if (command === 'qualid' && chat.isGroup) {
                    const idDeste = message.to;
                    const response = `O id deste grupo é:\n\n${idDeste}`;
                    client.sendMessage(mainGroupID, response)
                        .then(() => {
                            console.log('Mensagem com id do grupo enviada com sucesso!');
                            message.react('\u{2705}'); // Reagir com o emoji verde quando o comando é reconhecido
                        })
                        .catch((error) => {
                            console.error('Erro ao enviar a mensagem com comandos:', error);
                            message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                        });
                } else {
                    if (command === 'qualid') {
                        const response = `Este chat não é um grupo, tente novamente em um grupo de conversa.`;
                        client.sendMessage(message.to, response)
                            .then(() => {
                                console.log('Mensagem com id do grupo enviada com sucesso!');
                                message.react('\u{274C}'); // Reagir com o emoji verde quando o comando é reconhecido
                            })
                            .catch((error) => {
                                console.error('Erro ao enviar a mensagem com comandos:', error);
                                message.react('\u{274C}'); // Reagir com o emoji vermelho quando o comando não é reconhecido
                            });
                    }
                }
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


// Funcao para obter o nome do reposit      rio a partir da URL do commit
function getRepoNameFromCommitURL(commitURL) {
    const regex = /github\.com\/([^\/]+\/[^\/]+)\/commit/;
    const match = commitURL.match(regex);
    return match ? match[1] : null;
}

function validateIDGroup(idGroup) {
    // XXXXXXXXXXXXXXXXXX@g.us // X = numero
    if (idGroup.includes("@g.us")) {
        const valorSeparado = idGroup.split('@');
        console.log(valorSeparado);
        return valorSeparado[0].length === 18 && valorSeparado[1] === 'g.us';
    } else {
        return false;
    }
}

// repoName && idGroup && validateIDGroup(idGroup)
// repo tem q estar em pending


/**
 * Valida tudo ou identifica um problema específico.
 * @returns {} True se tudo validado.
 * @returns {} 1 se repo não está mais pendente de vinculo com grupo.
 * @returns {} 2 se informado um id de grupo inválido.
 * @returns {} 3 se não informado um id de grupo e/ou nome da repo.
 */
function validacaoInformarID(NomeRepo, idGrupo) {
    // Returna True se tudo valido
    // Retorna 1 se o repo nao esta mais pendente de vinculação com grupo
    // Retorna 2 se informado um id de grupo invalido
    if (NomeRepo === undefined && idGrupo === undefined) {
        return 3;
    } else {
        if (memory.pending[NomeRepo] === false) {
            return 1;
        } else if (!validateIDGroup(idGrupo) || idGrupo === "555195660801-1424668624@g.us") {
            return 2;
        } else if (memory.pending[NomeRepo] === true && idGrupo && validateIDGroup(idGrupo)) {
            return true;
        }
    }
}