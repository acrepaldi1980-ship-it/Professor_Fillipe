// Guided paths (Prompt 2.7): optional study paths led by the teacher, one short step a day. The content is ours (title, goal, passage); the
// teacher opens each day from the passage and the goal, with sources, like any other study. Passages are canonical references checked against the Bible.
export interface PathDay { day: number; title: string; ref: string; goal: string }
export interface PathDef { id: string; title: string; description: string; level: "iniciante" | "intermediário"; days: PathDay[] }

const d = (day: number, title: string, ref: string, goal: string): PathDay => ({ day, title, ref, goal });

export const PATHS: PathDef[] = [
  { id: "at30", title: "Panorama do Antigo Testamento em 30 dias", level: "iniciante", description: "Um passo por dia, da criação ao último profeta, para enxergar a história inteira e como ela aponta para Cristo.", days: [
    d(1, "No princípio: criação e queda", "GEN.1.1-GEN.3.24", "Entender de onde vem o mundo, o ser humano e o problema do pecado."),
    d(2, "Noé e o dilúvio", "GEN.6.9-GEN.9.17", "Ver o juízo e a graça de Deus e o sinal da primeira aliança."),
    d(3, "Abraão: a promessa", "GEN.12.1-GEN.15.6", "Perceber que a história passa a seguir uma promessa e a fé de Abraão."),
    d(4, "Isaque e Jacó", "GEN.25.19-GEN.28.22", "Ver como a promessa passa de geração em geração, apesar das falhas."),
    d(5, "José no Egito", "GEN.37.1-GEN.50.26", "Descobrir como Deus cuida da família e leva o povo ao Egito."),
    d(6, "O Êxodo", "EXO.3.1-EXO.15.21", "Entender a libertação da escravidão e a Páscoa."),
    d(7, "A aliança no Sinai", "EXO.19.1-EXO.24.18", "Ver a lei como parte de uma aliança, dada a um povo já libertado."),
    d(8, "O tabernáculo", "EXO.25.1-EXO.40.38", "Compreender como Deus habita no meio do povo."),
    d(9, "Levítico: santidade e sacrifício", "LEV.16.1-LEV.16.34", "Entender o Dia da Expiação e o que ele ensina sobre perdão."),
    d(10, "No deserto: os espias", "NUM.13.1-NUM.14.45", "Ver o efeito da incredulidade e a paciência de Deus."),
    d(11, "Deuteronômio: ouve, Israel", "DEU.6.1-DEU.6.25", "Entender o Shemá e o que é amar a Deus de todo o coração."),
    d(12, "Josué: a entrada na terra", "JOS.1.1-JOS.6.27", "Ver como Deus cumpre a promessa da terra."),
    d(13, "Os juízes", "JDG.2.6-JDG.3.31", "Notar o ciclo de pecado, castigo, clamor e livramento."),
    d(14, "Rute", "RUT.1.1-RUT.4.22", "Ver a fidelidade de Deus em uma história comum e o redentor."),
    d(15, "Samuel e o primeiro rei", "1SA.8.1-1SA.10.27", "Entender por que Israel pediu um rei e o que isso revela."),
    d(16, "Davi e a aliança", "2SA.7.1-2SA.7.29", "Compreender a promessa de um rei eterno da casa de Davi."),
    d(17, "O pecado de Davi", "2SA.11.1-2SA.12.25", "Ver o pecado, o arrependimento e a graça."),
    d(18, "Salomão e o templo", "1KI.8.1-1KI.8.66", "Entender o templo e a oração de dedicação."),
    d(19, "Elias", "1KI.18.16-1KI.19.18", "Ver os profetas chamando o povo de volta à aliança."),
    d(20, "O reino dividido e o exílio", "2KI.17.1-2KI.17.23", "Compreender por que as duas nações foram para o exílio."),
    d(21, "Isaías: o Servo sofredor", "ISA.52.13-ISA.53.12", "Ler a profecia sobre o Servo e a ligação com Cristo."),
    d(22, "Jeremias: a nova aliança", "JER.31.31-JER.31.34", "Ver a promessa de um coração novo."),
    d(23, "Ezequiel: os ossos secos", "EZK.37.1-EZK.37.14", "Ver a esperança de restauração dada no exílio."),
    d(24, "Daniel na Babilônia", "DAN.1.1-DAN.3.30", "Aprender a fidelidade em terra estrangeira."),
    d(25, "Jonas", "JON.1.1-JON.4.11", "Ver a compaixão de Deus por todos os povos."),
    d(26, "Os profetas menores: Amós e Miqueias", "AMO.5.21-AMO.5.24", "Entender a justiça que Deus espera do seu povo."),
    d(27, "O retorno: Esdras e Neemias", "EZR.1.1-EZR.1.11", "Ver a volta do exílio e a reconstrução."),
    d(28, "Ester", "EST.4.1-EST.4.17", "Ver o cuidado de Deus mesmo quando ele não é nomeado."),
    d(29, "Os Salmos", "PSA.1.1-PSA.1.6", "Aprender a orar com os Salmos."),
    d(30, "Malaquias e a espera", "MAL.3.1-MAL.4.6", "Terminar o Antigo Testamento esperando aquele que viria."),
  ] },
  { id: "paulo14", title: "A vida de Paulo em 14 dias", level: "intermediário", description: "De perseguidor a apóstolo: a conversão, as viagens e as cartas, no ritmo de um passo por dia.", days: [
    d(1, "Saulo, o perseguidor", "ACT.7.54-ACT.8.3", "Ver de onde Paulo parte."),
    d(2, "O encontro no caminho de Damasco", "ACT.9.1-ACT.9.31", "Entender a conversão e o chamado."),
    d(3, "Antioquia e o envio", "ACT.11.19-ACT.13.3", "Ver a igreja que envia missionários."),
    d(4, "A primeira viagem", "ACT.13.4-ACT.14.28", "Acompanhar Chipre e a Galácia."),
    d(5, "O concílio de Jerusalém", "ACT.15.1-ACT.15.35", "Entender a salvação pela graça para judeus e gentios."),
    d(6, "Filipos", "ACT.16.6-ACT.16.40", "Ver o evangelho chegar à Europa."),
    d(7, "Atenas", "ACT.17.16-ACT.17.34", "Aprender a falar de Cristo a quem não conhece a Bíblia."),
    d(8, "Corinto", "ACT.18.1-ACT.18.28", "Ver o ministério e a perseverança de Paulo."),
    d(9, "Éfeso", "ACT.19.1-ACT.19.41", "Acompanhar o ministério mais longo de Paulo."),
    d(10, "A despedida dos presbíteros", "ACT.20.17-ACT.20.38", "Ouvir o coração pastoral de Paulo."),
    d(11, "A prisão em Jerusalém", "ACT.21.27-ACT.22.29", "Ver o testemunho de Paulo diante do povo."),
    d(12, "Diante de Festo e Agripa", "ACT.26.1-ACT.26.32", "Ver como Paulo conta a sua história."),
    d(13, "A tempestade e o naufrágio", "ACT.27.1-ACT.27.44", "Ver a confiança de Paulo no meio do perigo."),
    d(14, "Em Roma, sem impedimento", "ACT.28.11-ACT.28.31", "Terminar a história de Atos e pensar no que fica."),
  ] },
  { id: "parabolas14", title: "As parábolas de Jesus em 14 dias", level: "iniciante", description: "Uma parábola por dia: a história, o contexto e o que Jesus quis ensinar.", days: [
    d(1, "O semeador", "MAT.13.1-MAT.13.23", "Entender como ouvimos a palavra."),
    d(2, "O joio e o trigo", "MAT.13.24-MAT.13.30", "Entender a paciência de Deus com o mal."),
    d(3, "A semente de mostarda e o fermento", "MAT.13.31-MAT.13.35", "Ver o crescimento discreto do reino."),
    d(4, "O tesouro e a pérola", "MAT.13.44-MAT.13.46", "Entender o valor do reino."),
    d(5, "O servo que não perdoou", "MAT.18.21-MAT.18.35", "Entender o perdão que recebemos e damos."),
    d(6, "Os trabalhadores da vinha", "MAT.20.1-MAT.20.16", "Entender a generosidade da graça."),
    d(7, "Os dois filhos", "MAT.21.28-MAT.21.32", "Ver a diferença entre dizer e fazer."),
    d(8, "Os lavradores maus", "MAT.21.33-MAT.21.46", "Entender a responsabilidade de quem recebe a vinha."),
    d(9, "A festa de casamento", "MAT.22.1-MAT.22.14", "Ver o convite do reino."),
    d(10, "As dez virgens", "MAT.25.1-MAT.25.13", "Entender o que é estar preparado."),
    d(11, "Os talentos", "MAT.25.14-MAT.25.30", "Entender a fidelidade no que recebemos."),
    d(12, "O bom samaritano", "LUK.10.25-LUK.10.37", "Entender quem é o meu próximo."),
    d(13, "A ovelha, a moeda e o filho perdidos", "LUK.15.1-LUK.15.32", "Ver a alegria de Deus pelo que se encontra."),
    d(14, "O fariseu e o publicano", "LUK.18.9-LUK.18.14", "Aprender a orar com humildade."),
  ] },
];

export const getPath = (id: string) => PATHS.find((p) => p.id === id);
export const nextDayOf = (path: PathDef, done: number) => path.days.find((x) => x.day === done + 1) ?? null;
