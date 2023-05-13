const memory = {
    main: {
        'api-allstack': '120363129757303262@g.us',
        'frontend': '120363148607141306@g.us'
    },
    pending: {
        'allstack-bot': true
    },
    blacklist: [
        'allstack'
    ]
};

let id = '120363092460966035@g.us';
let repo = 'allstack-bot';

function validacaoInformarID(NomeRepo, idGrupo){
    return memory.pending[NomeRepo] === true && idGrupo && validateIDGroup(idGrupo);
}

function validateIDGroup(idGroup){
    // XXXXXXXXXXXXXXXXXX@g.us // X = numero
    const valorSeparado = idGroup.split('@');
    console.log(valorSeparado);
    return valorSeparado[0].length === 18 && valorSeparado[1] === 'g.us';
}



console.log(validacaoInformarID(repo, id));