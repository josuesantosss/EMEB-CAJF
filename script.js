// ============================================
// HELPERS
// ============================================
function texto(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim();
}

function isAtivo(valor) {
    const v = texto(valor).toUpperCase();
    if (v === '') return true;
    return !['NÃO', 'NAO', 'FALSE', 'N', '0'].includes(v);
}

function normalizarTurma(valor) {
    return texto(valor)
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\bANO\b/g, '')
        .replace(/[^A-Z0-9]/g, '');
}

function normalizarNome(valor) {
    return texto(valor)
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^PROF(ESSOR|ESSORA)?\.?\s/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function valorCelula(cell) {
    if (!cell) return '';
    const v = cell.v;
    if (v === null || v === undefined) return cell.f || '';
    if (typeof v === 'string') {
        const m = /^Date\((\d+),(\d+),(\d+)/.exec(v);
        if (m) {
            const d = new Date(Number(m[1]), Number(m[2]), Number(m[3]));
            return d.toISOString().split('T')[0];
        }
    }
    return v;
}

function labelTurma(turma) {
    return (escolaData.turmasLabel && escolaData.turmasLabel[turma]) || turma;
}

// ============================================
// FUNÇÃO PARA MOSTRAR/OCULTAR SENHA
// ============================================
function toggleSenha() {
    const input = document.getElementById('loginSenha');
    const btn = document.querySelector('.password-toggle');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

// ============================================
// CONFIGURAÇÃO DA PLANILHA
// ============================================
const SHEET_CONFIG = {
    sheetId: '1vfgwXNrZuQ8KBcjCuJB_5RKUQ3imAYbAHsMX1yG3It0',
    abas: {
        login: 'LOGIN',
        alunos: 'TURMAS_ALUNOS',
        atribuicoes: 'ATRIBUICOES',
        notas: 'NOTAS_BIMESTRAIS',
        presencas: 'PRESENCAS',
        conteudos: 'CONTEUDOS',
        observacoes: 'OBSERVACOES',
        relatoriosSolicitados: 'RELATORIOS_SOLICITADOS',
        relatoriosGerados: 'RELATORIOS_GERADOS'
    }
};

// ============================================
// DADOS CARREGADOS DA PLANILHA
// ============================================
let dadosPlanilha = {
    login: [],
    alunos: [],
    atribuicoes: [],
    notas: [],
    presencas: [],
    conteudos: [],
    observacoes: [],
    relatoriosSolicitados: [],
    relatoriosGerados: []
};

// ============================================
// BANCO DE DADOS LOCAL
// ============================================
let escolaData = {
    turmas: [],
    turmasLabel: {},
    alunos: {},
    professores: []
};

let db = {
    atribuicoes: {},
    notas: {},
    presencas: {},
    observacoes: {},
    conteudos: {},
    relatoriosGerados: [],
    solicitacoes: []
};

// ============================================
// USUÁRIO LOGADO
// ============================================
let usuarioLogado = null;

// ============================================
// FUNÇÃO PARA CARREGAR O DROPDOWN DE USUÁRIOS
// ============================================
function carregarUsuariosDropdown() {
    const select = document.getElementById('loginUsuario');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    
    if (!dadosPlanilha.login || dadosPlanilha.login.length === 0) {
        select.innerHTML = '<option value="">-- Nenhum usuário cadastrado --</option>';
        return;
    }
    
    dadosPlanilha.login.forEach(user => {
        const nome = texto(user.Nome || user.nome || user['Nome']);
        if (nome) {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            select.appendChild(option);
        }
    });
    
    console.log('📋 Usuários carregados no dropdown:', select.options.length - 1);
    console.log('📋 Opções do dropdown:', Array.from(select.options).map(o => o.value));
}

// ============================================
// FUNÇÃO PARA CARREGAR DADOS DA PLANILHA
// ============================================
async function carregarDadosPlanilha() {
    const loading = document.getElementById('loadingOverlay');
    loading.classList.add('active');

    try {
        console.log('📡 Iniciando carregamento da planilha...');
        
        for (const [key, aba] of Object.entries(SHEET_CONFIG.abas)) {
            await carregarAbaEspecifica(aba, key);
        }

        atualizarBancoDados();
        
        // Carrega o dropdown de usuários
        carregarUsuariosDropdown();

        // RECARREGA OS DROPDOWNS
        if (usuarioLogado && usuarioLogado.perfil === 'coordenacao') {
            console.log('🔄 Recarregando dropdowns para Coordenação...');
            carregarProfessoresAtribuicao();
            carregarTurmasSelect();
            carregarSolicitacaoTurmas();
            renderVisaoGeralTurmas();
            renderSolicitacoes();
        }

        const totalAlunos = dadosPlanilha.alunos.length;
        const totalProfessores = escolaData.professores.length;
        const totalAtribuicoes = dadosPlanilha.atribuicoes.length;
        const totalNotas = dadosPlanilha.notas.length;
        const totalPresencas = dadosPlanilha.presencas.length;
        const totalConteudos = dadosPlanilha.conteudos.length;
        const totalObservacoes = dadosPlanilha.observacoes.length;
        const totalSolicitacoes = dadosPlanilha.relatoriosSolicitados.length;
        const totalRelatorios = dadosPlanilha.relatoriosGerados.length;

        const status = document.getElementById('dataStatus');
        status.innerHTML = `✅ Dados carregados: ${totalAlunos} alunos, ${totalProfessores} professores, ${totalAtribuicoes} atribuições, ${totalNotas} notas, ${totalPresencas} presenças, ${totalConteudos} conteúdos, ${totalObservacoes} observações, ${totalSolicitacoes} solicitações, ${totalRelatorios} relatórios`;
        
        document.getElementById('syncStatus').className = 'sync-status synced';
        document.getElementById('syncStatus').textContent = '✅ Sincronizado';

        console.log('📊 Resumo dos dados carregados da planilha:', {
            login: dadosPlanilha.login.length,
            alunos: totalAlunos,
            professores: totalProfessores,
            atribuicoes: totalAtribuicoes,
            notas: totalNotas,
            presencas: totalPresencas,
            conteudos: totalConteudos,
            observacoes: totalObservacoes,
            relatoriosSolicitados: totalSolicitacoes,
            relatoriosGerados: totalRelatorios
        });

    } catch (error) {
        console.error('❌ Erro detalhado:', error);
        document.getElementById('syncStatus').className = 'sync-status error';
        document.getElementById('syncStatus').textContent = '❌ Erro ao carregar';
        
        alert('❌ Erro ao carregar dados da planilha.\n\n' +
              '⚠️ IMPORTANTE: Sua planilha precisa estar PÚBLICA!\n\n' +
              'Para tornar pública:\n' +
              '1. Abra sua planilha no Google Sheets\n' +
              '2. Clique em "Arquivo" → "Compartilhar" → "Publicar na web"\n' +
              '3. Ou clique em "Compartilhar" (botão azul)\n' +
              '4. Mude para "Qualquer pessoa com o link"\n\n' +
              'Detalhes do erro: ' + error.message);
    } finally {
        loading.classList.remove('active');
    }
}

async function carregarAbaEspecifica(nomeAba, chave) {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(nomeAba)}`;
        console.log(`🔗 Carregando aba ${nomeAba}...`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status} ao carregar aba ${nomeAba}`);
        }

        const text = await response.text();
        const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);

        if (data.table && data.table.rows) {
            const cols = data.table.cols.map(c => texto(c.label) || c.id || '');
            dadosPlanilha[chave] = data.table.rows.map(row => {
                const obj = {};
                (row.c || []).forEach((cell, i) => {
                    obj[cols[i] || `coluna_${i}`] = valorCelula(cell);
                });
                return obj;
            });
            console.log(`✅ ${chave} carregados:`, dadosPlanilha[chave].length);
            
            if (dadosPlanilha[chave].length > 0) {
                console.log(`📋 Primeiros registros de ${chave}:`, dadosPlanilha[chave].slice(0, 3));
                console.log(`📋 Colunas de ${chave}:`, Object.keys(dadosPlanilha[chave][0]));
            }
        } else {
            console.warn(`⚠️ Aba "${nomeAba}" está vazia ou sem dados`);
            dadosPlanilha[chave] = [];
        }
    } catch (error) {
        console.error(`❌ Erro ao carregar aba ${nomeAba}:`, error);
        dadosPlanilha[chave] = [];
    }
}

// ============================================
// ATUALIZAR BANCO DE DADOS LOCAL
// ============================================
function atualizarBancoDados() {
    console.log('🔄 Atualizando banco de dados local a partir da planilha...');

    // ============================================
    // 0. LOGIN - apenas armazena os dados para autenticação
    // ============================================
    console.log('📋 Dados de login carregados:', dadosPlanilha.login.length);

    // ============================================
    // 1. PROFESSORES (derivados da aba ATRIBUICOES)
    // ============================================
    const professoresMap = new Map();
    dadosPlanilha.atribuicoes.forEach(attr => {
        const id = texto(attr.ID_Professor || attr.IDProfessor);
        const nome = texto(attr.Nome_Professor || attr.NomeProfessor);
        const tipo = texto(attr.Tipo) || 'Regente';
        if (id && nome && !professoresMap.has(id) && isAtivo(attr.Ativo)) {
            professoresMap.set(id, { 
                id, 
                nome, 
                tipo, 
                email: '', 
                telefone: '', 
                formacao: '', 
                dataAdmissao: '' 
            });
        }
    });
    escolaData.professores = Array.from(professoresMap.values())
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    console.log('👨‍🏫 Professores carregados (derivados de ATRIBUICOES):', escolaData.professores.length);
    console.log('📋 Lista de professores:', escolaData.professores.map(p => p.nome).join(', '));

    // ============================================
    // 2. ALUNOS POR TURMA (chave normalizada)
    // ============================================
    const novosAlunos = {};
    escolaData.turmasLabel = {};
    
    dadosPlanilha.alunos.forEach(aluno => {
        const bruta = texto(aluno.Turma);
        const turma = normalizarTurma(bruta);
        const nome = texto(aluno.Nome_Aluno || aluno.Nome);
        if (!turma || !nome || !isAtivo(aluno.Ativo)) return;
        
        if (!escolaData.turmasLabel[turma]) {
            escolaData.turmasLabel[turma] = bruta;
        }
        if (!novosAlunos[turma]) {
            novosAlunos[turma] = [];
        }
        if (!novosAlunos[turma].includes(nome)) {
            novosAlunos[turma].push(nome);
        }
    });
    
    escolaData.alunos = novosAlunos;
    escolaData.turmas = Object.keys(novosAlunos).sort();
    console.log('👥 Alunos atualizados por turma:', Object.keys(novosAlunos).length);
    console.log('🏫 Turmas encontradas:', escolaData.turmas.length);
    console.log('📋 Turmas com labels:', escolaData.turmasLabel);

    // ============================================
    // 3. ATRIBUIÇÕES
    // ============================================
    const novasAtribuicoes = {};
    dadosPlanilha.atribuicoes.forEach(attr => {
        const profId = texto(attr.ID_Professor || attr.IDProfessor);
        const turma = normalizarTurma(attr.Turma);
        if (!profId || !turma || !isAtivo(attr.Ativo)) return;
        
        if (!novasAtribuicoes[profId]) {
            novasAtribuicoes[profId] = [];
        }
        if (!novasAtribuicoes[profId].includes(turma)) {
            novasAtribuicoes[profId].push(turma);
        }
    });
    db.atribuicoes = novasAtribuicoes;
    console.log('📋 Atribuições atualizadas:', Object.keys(novasAtribuicoes).length);

    // ============================================
    // 4. NOTAS
    // ============================================
    db.notas = {};
    dadosPlanilha.notas.forEach(nota => {
        const turma = normalizarTurma(nota.Turma);
        const aluno = texto(nota.Aluno);
        const bimestre = parseInt(nota.Bimestre) || 1;
        const valor = parseFloat(nota.Nota) || 0;
        
        if (turma && aluno) {
            if (!db.notas[turma]) db.notas[turma] = {};
            if (!db.notas[turma][aluno]) db.notas[turma][aluno] = { 1: 0, 2: 0, 3: 0, 4: 0 };
            if (bimestre >= 1 && bimestre <= 4) {
                db.notas[turma][aluno][bimestre] = valor;
            }
        }
    });
    console.log('📝 Notas atualizadas:', Object.keys(db.notas).length);

    // ============================================
    // 5. PRESENÇAS
    // ============================================
    db.presencas = {};
    dadosPlanilha.presencas.forEach(p => {
        const turma = normalizarTurma(p.Turma);
        if (turma) {
            if (!db.presencas[turma]) db.presencas[turma] = [];
            const presentes = (p.Alunos_Presentes || '').split(';').filter(a => texto(a));
            db.presencas[turma].push({
                data: p.Data || '',
                presentes: presentes,
                obs: p.Observacao_Aula || ''
            });
        }
    });
    console.log('✅ Presenças atualizadas:', Object.keys(db.presencas).length);

    // ============================================
    // 6. CONTEÚDOS
    // ============================================
    db.conteudos = {};
    dadosPlanilha.conteudos.forEach(c => {
        const turma = normalizarTurma(c.Turma);
        if (turma) {
            if (!db.conteudos[turma]) db.conteudos[turma] = [];
            db.conteudos[turma].push({
                data: c.Data || '',
                disciplina: c.Disciplina || '',
                conteudo: c.Conteudo || '',
                objetivos: c.Objetivos || ''
            });
        }
    });
    console.log('📚 Conteúdos atualizados:', Object.keys(db.conteudos).length);

    // ============================================
    // 7. OBSERVAÇÕES
    // ============================================
    db.observacoes = {};
    dadosPlanilha.observacoes.forEach(o => {
        const turma = normalizarTurma(o.Turma);
        if (turma) {
            if (!db.observacoes[turma]) db.observacoes[turma] = [];
            db.observacoes[turma].push({
                data: o.Data || '',
                aluno: o.Aluno || '',
                observacao: o.Observacao || '',
                tipo: o.Tipo || 'Neutra'
            });
        }
    });
    console.log('✏️ Observações atualizadas:', Object.keys(db.observacoes).length);

    // ============================================
    // 8. SOLICITAÇÕES DE RELATÓRIO
    // ============================================
    db.solicitacoes = dadosPlanilha.relatoriosSolicitados.map(s => ({
        turma: normalizarTurma(s.Turma),
        aluno: texto(s.Aluno),
        bimestre: s.Bimestre || '1',
        data: s.Data_Solicitacao || '',
        status: s.Status || 'Pendente',
        dataConclusao: s.Data_Conclusao || '',
        observacoes: s.Observacoes || ''
    }));
    console.log('📄 Solicitações atualizadas:', db.solicitacoes.length);

    // ============================================
    // 9. RELATÓRIOS GERADOS
    // ============================================
    db.relatoriosGerados = dadosPlanilha.relatoriosGerados.map(r => ({
        turma: normalizarTurma(r.Turma),
        aluno: texto(r.Aluno),
        bimestre: r.Bimestre || '1',
        data: r.Data_Geracao || '',
        professor: r.Professor || '',
        notas: r.Notas || '',
        media: parseFloat(r.Media) || 0,
        presenca: parseFloat(r.Presenca) || 0,
        observacoes: r.Observacoes || '',
        recomendacao: r.Recomendacao || ''
    }));
    console.log('📋 Relatórios gerados atualizados:', db.relatoriosGerados.length);

    console.log('✅ Banco de dados atualizado com sucesso!');
}

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO - AGORA POR NOME
// ============================================
function autenticarUsuario(nome, senha) {
    console.log('🔍 Tentando autenticar:', nome);
    console.log('📋 Dados de login disponíveis:', dadosPlanilha.login);
    console.log('📋 Colunas disponíveis:', dadosPlanilha.login.length > 0 ? Object.keys(dadosPlanilha.login[0]) : 'nenhuma');
    
    // Normaliza os nomes das colunas para comparação
    const user = dadosPlanilha.login.find(u => {
        // Busca pelo Nome (coluna C) e Senha (coluna D)
        const nomeUsuario = texto(u.Nome || u.nome || u['Nome']);
        const senhaUsuario = texto(u.Senha || u.senha || u['Senha']);
        
        console.log(`   Comparando: Nome="${nomeUsuario}" com "${nome}", Senha="${senhaUsuario}" com "${senha}"`);
        return nomeUsuario === nome && senhaUsuario === senha;
    });
    
    if (user) {
        console.log('✅ Usuário autenticado:', user);
        // Tenta encontrar os campos independente da capitalização
        const id = texto(user.iD_Login || user.ID_Login || user.id_Login || user.IDLogin || user['iD_Login'] || user['ID_Login']);
        const perfil = texto(user.PERFIL || user.perfil || user.Perfil || user['PERFIL']);
        const nome = texto(user.Nome || user.nome || user['Nome']);
        const senha = texto(user.Senha || user.senha || user['Senha']);
        
        return {
            id: id,
            perfil: perfil,
            nome: nome,
            senha: senha
        };
    }
    console.log('❌ Usuário não encontrado ou senha inválida');
    return null;
}

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================
function getAlunosByTurma(turma) {
    const normalizada = normalizarTurma(turma);
    return escolaData.alunos[normalizada] || [];
}

function getTurmasByProfessor(profId) {
    return db.atribuicoes[profId] || [];
}

function getProfessorById(id) {
    return escolaData.professores.find(p => p.id === id);
}

function getProfessorIdByNome(nome) {
    const alvo = normalizarNome(nome);
    const prof = escolaData.professores.find(p => normalizarNome(p.nome) === alvo);
    return prof ? prof.id : null;
}

function getNotasAluno(turma, aluno) {
    const t = normalizarTurma(turma);
    if (!db.notas[t]) return { 1: 0, 2: 0, 3: 0, 4: 0 };
    if (!db.notas[t][aluno]) return { 1: 0, 2: 0, 3: 0, 4: 0 };
    return db.notas[t][aluno];
}

function calcularMedia(notas) {
    const valores = Object.values(notas).filter(n => n > 0);
    if (valores.length === 0) return 0;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function getUltimosRegistros(registros, limite = 10) {
    return registros.slice(-limite).reverse();
}

// ============================================
// MAPEAMENTO DE PERFIS PARA CARGOS
// ============================================
const perfilParaCargo = {
    'Coordenação Pedagógica': 'coordenacao',
    'Coordenacao Pedagogica': 'coordenacao',
    'COORDENACAO PEDAGOGICA': 'coordenacao',
    'coordenacao pedagogica': 'coordenacao',
    'Direção': 'direcao',
    'Direcao': 'direcao',
    'Secretaria': 'secretaria',
    'Secretaria 1': 'secretaria',
    'Gerente': 'direcao',
    'Professor Regente': 'professor-regente',
    'Professor': 'professor-regente'
};

function mapearPerfilParaCargo(perfil) {
    const perfilNormalizado = texto(perfil);
    for (const [key, value] of Object.entries(perfilParaCargo)) {
        if (perfilNormalizado.toUpperCase() === key.toUpperCase()) {
            return value;
        }
    }
    // Se não encontrar, tenta buscar por substring
    if (perfilNormalizado.toUpperCase().includes('COORDENACAO') || perfilNormalizado.toUpperCase().includes('COORDENAÇÃO')) {
        return 'coordenacao';
    }
    if (perfilNormalizado.toUpperCase().includes('DIRECAO') || perfilNormalizado.toUpperCase().includes('DIREÇÃO')) {
        return 'direcao';
    }
    if (perfilNormalizado.toUpperCase().includes('SECRETARIA')) {
        return 'secretaria';
    }
    if (perfilNormalizado.toUpperCase().includes('PROFESSOR')) {
        return 'professor-regente';
    }
    return perfilNormalizado.toLowerCase().replace(/\s/g, '-');
}

// ============================================
// CONFIGURAÇÃO DE CARGOS
// ============================================
const cargoConfig = {
    'direcao': {
        titulo: '👔 Direção',
        cores: 'direcao',
        funcionalidades: ['Painel Gerencial', 'Relatórios Consolidados', 'Visão Completa da Escola']
    },
    'vice-direcao': {
        titulo: '👔 Vice-Direção',
        cores: 'direcao',
        funcionalidades: ['Acompanhamento Gerencial', 'Relatórios', 'Suporte à Direção']
    },
    'secretaria': {
        titulo: '📁 Secretaria Escolar',
        cores: 'secretaria',
        funcionalidades: ['Matrículas', 'Documentação', 'Históricos', 'Atestados']
    },
    'coordenacao': {
        titulo: '📚 Coordenação Pedagógica',
        cores: 'coordenacao',
        funcionalidades: ['Visão por Turma', 'Atribuição de Turmas', 'Solicitar Relatórios', 'Acompanhamento Pedagógico']
    },
    'professor-regente': {
        titulo: '👨‍🏫 Professor Regente',
        cores: 'professor',
        funcionalidades: ['Notas Bimestrais', 'Presenças', 'Conteúdos', 'Observações', 'Relatórios']
    },
    'professor-artes': {
        titulo: '🎨 Professor de Artes',
        cores: 'especialista',
        funcionalidades: ['Notas Bimestrais', 'Presenças', 'Conteúdos', 'Observações', 'Relatórios']
    },
    'professor-musica': {
        titulo: '🎵 Professor de Música',
        cores: 'especialista',
        funcionalidades: ['Notas Bimestrais', 'Presenças', 'Conteúdos', 'Observações', 'Relatórios']
    },
    'professor-ingles': {
        titulo: '🌎 Professor de Inglês',
        cores: 'especialista',
        funcionalidades: ['Notas Bimestrais', 'Presenças', 'Conteúdos', 'Observações', 'Relatórios']
    },
    'professor-ef': {
        titulo: '🏃 Professor de Educação Física',
        cores: 'especialista',
        funcionalidades: ['Notas Bimestrais', 'Presenças', 'Conteúdos', 'Observações', 'Relatórios']
    }
};

// ============================================
// ESTADO DO USUÁRIO
// ============================================
let currentUser = {
    cargo: '',
    nome: '',
    turmas: []
};

let turmaSelecionada = null;

// ============================================
// LOGIN
// ============================================
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const nome = document.getElementById('loginUsuario').value;
    const senha = document.getElementById('loginSenha').value.trim();

    if (!nome || !senha) {
        mostrarErroLogin('Por favor, preencha todos os campos.');
        return;
    }

    console.log('📝 Tentando login com Nome:', nome, 'Senha:', senha);

    // Tenta autenticar pelo NOME
    const user = autenticarUsuario(nome, senha);
    
    if (!user) {
        mostrarErroLogin('❌ Usuário ou senha inválidos. Tente novamente.');
        return;
    }

    // Limpa erro
    document.getElementById('loginError').classList.remove('show');

    // Define o usuário logado
    usuarioLogado = user;
    
    // Mapeia o perfil para cargo
    const cargo = mapearPerfilParaCargo(user.perfil);
    
    currentUser.cargo = cargo;
    currentUser.nome = user.nome;

    console.log('✅ Login bem-sucedido:', { usuario: user.id, nome: user.nome, perfil: user.perfil, cargo: cargo });

    // Se for professor, busca as turmas atribuídas
    if (cargo.startsWith('professor')) {
        const profId = getProfessorIdByNome(user.nome);
        if (profId) {
            currentUser.turmas = getTurmasByProfessor(profId);
        } else {
            currentUser.turmas = [];
        }
        console.log('📚 Turmas do professor:', currentUser.turmas);
    }

    // Oculta login e mostra dashboard
    document.getElementById('loginContainer').style.display = 'none';
    const dashboard = document.getElementById('dashboard');
    dashboard.classList.add('active');

    // Carrega os dados da planilha (se já não estiverem carregados)
    if (dadosPlanilha.alunos.length === 0) {
        carregarDadosPlanilha().then(() => {
            renderDashboard(cargo);
        });
    } else {
        renderDashboard(cargo);
    }
});

function mostrarErroLogin(mensagem) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = mensagem;
    errorEl.classList.add('show');
}

// ============================================
// RENDERIZAÇÃO DO DASHBOARD
// ============================================
function renderDashboard(cargo) {
    const config = cargoConfig[cargo];
    if (!config) {
        console.error('Cargo não encontrado:', cargo);
        return;
    }
    
    renderCards(config);

    document.getElementById('dashboardTitle').textContent = `📊 ${config.titulo}`;
    document.getElementById('userDisplay').textContent = `👤 ${currentUser.nome} - ${config.titulo}`;

    document.getElementById('professorArea').classList.add('hidden');
    document.getElementById('coordenadorArea').classList.add('hidden');
    document.getElementById('direcaoArea').classList.add('hidden');

    if (cargo.startsWith('professor')) {
        document.getElementById('professorArea').classList.remove('hidden');
        document.getElementById('turmasSection').classList.remove('hidden');
        document.getElementById('registrosSection').classList.remove('hidden');
        renderMinhasTurmas();
        carregarAlunosSelects();
        carregarPresenca();
        carregarConteudos();
    }

    if (cargo === 'coordenacao') {
        document.getElementById('coordenadorArea').classList.remove('hidden');
        carregarProfessoresAtribuicao();
        carregarTurmasSelect();
        carregarSolicitacaoTurmas();
        renderVisaoGeralTurmas();
        renderSolicitacoes();
    }

    if (cargo === 'direcao' || cargo === 'vice-direcao') {
        document.getElementById('direcaoArea').classList.remove('hidden');
        renderStatsGerenciais();
        carregarTurmasDirecao();
    }
}

function renderCards(config) {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = `
        <div class="card ${config.cores}">
            <h3>📌 ${config.titulo}</h3>
            <p>Bem-vindo ao seu painel de controle</p>
            <span class="badge">Acesso Ativo</span>
        </div>
        ${config.funcionalidades.map(func => `
            <div class="card ${config.cores}">
                <h3>${func}</h3>
                <p>Funcionalidade disponível</p>
            </div>
        `).join('')}
    `;
}

// ============================================
// PROFESSOR - MINHAS TURMAS
// ============================================
function renderMinhasTurmas() {
    const container = document.getElementById('turmasContainer');

    if (currentUser.turmas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #718096;">
                <p>📭 Nenhuma turma atribuída.</p>
                <p style="font-size: 0.9em;">Entre em contato com a coordenação.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentUser.turmas.map(turma => `
        <div class="turma-item ${turmaSelecionada === turma ? 'selected' : ''}" 
             onclick="selecionarTurma('${turma}')">
            ${labelTurma(turma)}
            <span class="ano">Fundamental I</span>
            <span class="status">✅ Ativa</span>
        </div>
    `).join('');

    if (!turmaSelecionada && currentUser.turmas.length > 0) {
        selecionarTurma(currentUser.turmas[0]);
    }
}

function selecionarTurma(turma) {
    turmaSelecionada = turma;
    document.getElementById('turmaSelecionadaNome').textContent = labelTurma(turma);
    renderMinhasTurmas();
    carregarTabelaNotas();
    carregarPresenca();
    carregarConteudos();
    carregarObservacoes();
    carregarRelatorios();
    carregarAlunosSelects();
}

// ============================================
// PROFESSOR - TABELA DE NOTAS
// ============================================
function carregarTabelaNotas() {
    if (!turmaSelecionada) return;

    const alunos = getAlunosByTurma(turmaSelecionada);
    const tbody = document.getElementById('tabelaNotasBody');
    
    if (alunos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #718096;">Nenhum aluno nesta turma</td></tr>';
        return;
    }

    tbody.innerHTML = alunos.map(aluno => {
        const notas = getNotasAluno(turmaSelecionada, aluno);
        const media = calcularMedia(notas);
        const alunoId = aluno.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        return `
            <tr>
                <td><strong>${aluno}</strong></td>
                <td><input type="number" class="nota-input" id="nota_${alunoId}_1" value="${notas[1] || 0}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="nota-input" id="nota_${alunoId}_2" value="${notas[2] || 0}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="nota-input" id="nota_${alunoId}_3" value="${notas[3] || 0}" min="0" max="10" step="0.5"></td>
                <td><input type="number" class="nota-input" id="nota_${alunoId}_4" value="${notas[4] || 0}" min="0" max="10" step="0.5"></td>
                <td><strong>${media.toFixed(1)}</strong></td>
                <td>
                    <button onclick="calcularMediaAluno('${aluno.replace(/'/g, "\\'")}')" class="btn btn-small btn-secondary" style="padding: 4px 8px; font-size: 12px;">📊</button>
                </td>
            </tr>
        `;
    }).join('');
}

function calcularMediaAluno(aluno) {
    if (!turmaSelecionada) return;
    const notas = {};
    const alunoId = aluno.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    for (let bim = 1; bim <= 4; bim++) {
        const input = document.getElementById(`nota_${alunoId}_${bim}`);
        notas[bim] = parseFloat(input.value) || 0;
    }
    const media = calcularMedia(notas);
    alert(`📊 Média de ${aluno}: ${media.toFixed(1)}`);
}

function calcularMedias() {
    if (!turmaSelecionada) return;
    const alunos = getAlunosByTurma(turmaSelecionada);
    let relatorio = '📊 Médias da Turma\n\n';
    relatorio += 'Aluno | 1ºB | 2ºB | 3ºB | 4ºB | Média\n';
    relatorio += '-'.repeat(50) + '\n';
    alunos.forEach(aluno => {
        const notas = {};
        const alunoId = aluno.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        for (let bim = 1; bim <= 4; bim++) {
            const input = document.getElementById(`nota_${alunoId}_${bim}`);
            notas[bim] = parseFloat(input.value) || 0;
        }
        const media = calcularMedia(notas);
        relatorio += `${aluno} | ${notas[1]} | ${notas[2]} | ${notas[3]} | ${notas[4]} | ${media.toFixed(1)}\n`;
    });
    alert(relatorio);
}

function salvarNotas() {
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }

    const alunos = getAlunosByTurma(turmaSelecionada);
    let salvos = 0;

    alunos.forEach(aluno => {
        if (!db.notas[turmaSelecionada]) {
            db.notas[turmaSelecionada] = {};
        }
        if (!db.notas[turmaSelecionada][aluno]) {
            db.notas[turmaSelecionada][aluno] = { 1: 0, 2: 0, 3: 0, 4: 0 };
        }
        const alunoId = aluno.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        for (let bim = 1; bim <= 4; bim++) {
            const input = document.getElementById(`nota_${alunoId}_${bim}`);
            if (input) {
                db.notas[turmaSelecionada][aluno][bim] = parseFloat(input.value) || 0;
                salvos++;
            }
        }
    });

    alert(`✅ ${salvos} notas salvas com sucesso!`);
    carregarTabelaNotas();
}

// ============================================
// PROFESSOR - PRESENÇAS
// ============================================
function carregarPresenca() {
    if (!turmaSelecionada) return;

    const alunos = getAlunosByTurma(turmaSelecionada);
    const container = document.getElementById('alunosPresenca');

    if (alunos.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhum aluno nesta turma</p>';
        return;
    }

    container.innerHTML = alunos.map(aluno => {
        const alunoId = aluno.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        return `
            <label>
                <input type="checkbox" id="pres_${alunoId}" value="${aluno}" checked>
                ${aluno}
            </label>
        `;
    }).join('');

    renderRegistrosPresenca();
}

function renderRegistrosPresenca() {
    const container = document.getElementById('registrosPresenca');
    const registros = db.presencas[turmaSelecionada] || [];

    if (registros.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhum registro de presença.</p>';
        return;
    }

    container.innerHTML = getUltimosRegistros(registros).map(r => `
        <div class="registro-item">
            <div class="data">📅 ${r.data} ${r.obs ? '- ' + r.obs : ''}</div>
            <div class="conteudo">✅ ${r.presentes.length} alunos presentes</div>
            <div style="font-size: 0.9em; color: #718096;">${r.presentes.join(', ')}</div>
        </div>
    `).join('');
}

function salvarPresenca() {
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }

    const data = document.getElementById('dataPresenca').value;
    const obs = document.getElementById('obsPresenca').value.trim();
    const checkboxes = document.querySelectorAll('#alunosPresenca input[type="checkbox"]:checked');
    const presentes = Array.from(checkboxes).map(cb => cb.value);

    if (presentes.length === 0) {
        alert('Marque pelo menos um aluno presente!');
        return;
    }

    if (!db.presencas[turmaSelecionada]) {
        db.presencas[turmaSelecionada] = [];
    }

    db.presencas[turmaSelecionada].push({ data, presentes, obs });
    
    renderRegistrosPresenca();
    alert('✅ Presença salva com sucesso!');

    document.querySelectorAll('#alunosPresenca input[type="checkbox"]').forEach(cb => cb.checked = true);
    document.getElementById('obsPresenca').value = '';
}

// ============================================
// PROFESSOR - CONTEÚDOS
// ============================================
function carregarConteudos() {
    renderConteudos();
}

function renderConteudos() {
    const container = document.getElementById('registrosConteudos');
    const registros = db.conteudos[turmaSelecionada] || [];

    if (registros.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhum conteúdo registrado.</p>';
        return;
    }

    container.innerHTML = getUltimosRegistros(registros).map(c => `
        <div class="registro-item">
            <div class="data">📚 ${c.data} - ${c.disciplina}</div>
            <div class="conteudo"><strong>Conteúdo:</strong> ${c.conteudo}</div>
            <div style="font-size: 0.9em; color: #718096;"><strong>Objetivos:</strong> ${c.objetivos || 'Não especificado'}</div>
        </div>
    `).join('');
}

function salvarConteudo() {
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }

    const data = document.getElementById('dataConteudo').value;
    const disciplina = document.getElementById('disciplinaConteudo').value.trim();
    const conteudo = document.getElementById('conteudoText').value.trim();
    const objetivos = document.getElementById('objetivosConteudo').value.trim();

    if (!conteudo) {
        alert('Digite o conteúdo trabalhado.');
        return;
    }

    if (!db.conteudos[turmaSelecionada]) {
        db.conteudos[turmaSelecionada] = [];
    }

    db.conteudos[turmaSelecionada].push({ data, disciplina, conteudo, objetivos });
    
    renderConteudos();
    document.getElementById('conteudoText').value = '';
    document.getElementById('objetivosConteudo').value = '';
    alert('✅ Conteúdo salvo com sucesso!');
}

// ============================================
// PROFESSOR - OBSERVAÇÕES
// ============================================
function carregarObservacoes() {
    renderObservacoes();
}

function renderObservacoes() {
    const container = document.getElementById('registrosObservacoes');
    const registros = db.observacoes[turmaSelecionada] || [];

    if (registros.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhuma observação registrada.</p>';
        return;
    }

    container.innerHTML = getUltimosRegistros(registros).map(o => `
        <div class="registro-item">
            <div class="data">✏️ ${o.data} - ${o.aluno}</div>
            <div class="conteudo">${o.observacao}</div>
            <div style="font-size: 0.9em; color: #718096;">Tipo: ${o.tipo}</div>
        </div>
    `).join('');
}

function salvarObservacao() {
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }

    const data = document.getElementById('dataObservacao').value;
    const aluno = document.getElementById('alunoObservacao').value;
    const observacao = document.getElementById('observacaoText').value.trim();
    const tipo = document.getElementById('tipoObservacao').value;

    if (!observacao) {
        alert('Digite a observação.');
        return;
    }

    if (!db.observacoes[turmaSelecionada]) {
        db.observacoes[turmaSelecionada] = [];
    }

    db.observacoes[turmaSelecionada].push({ data, aluno, observacao, tipo });
    
    renderObservacoes();
    document.getElementById('observacaoText').value = '';
    alert('✅ Observação salva com sucesso!');
}

// ============================================
// PROFESSOR - RELATÓRIOS
// ============================================
function carregarRelatorios() {
    carregarAlunosSelects();
    renderSolicitacoesRelatorios();
}

function renderSolicitacoesRelatorios() {
    const container = document.getElementById('solicitacoesRelatorios');
    const solicitacoes = db.solicitacoes.filter(s => s.turma === turmaSelecionada);

    if (solicitacoes.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhuma solicitação de relatório.</p>';
        return;
    }

    container.innerHTML = solicitacoes.map(s => `
        <div class="registro-item">
            <div class="data">📄 ${s.aluno} - ${s.bimestre === 'anual' ? 'Anual' : s.bimestre + 'º Bimestre'}</div>
            <div class="conteudo">
                Solicitado em: ${s.data}
                <span class="status-badge ${s.status === 'Concluído' ? 'concluido' : 'pendente'}">${s.status}</span>
                ${s.status === 'Pendente' ? `<button onclick="gerarRelatorioSolicitado('${s.aluno.replace(/'/g, "\\'")}', '${s.bimestre}')" class="btn btn-small btn-secondary" style="margin-left: 10px; padding: 4px 12px;">Gerar</button>` : ''}
            </div>
        </div>
    `).join('');
}

function gerarRelatorioSolicitado(aluno, bimestre) {
    gerarRelatorio(aluno, bimestre);
    const solicitacao = db.solicitacoes.find(s => 
        s.turma === turmaSelecionada && s.aluno === aluno && s.bimestre === bimestre
    );
    if (solicitacao) {
        solicitacao.status = 'Concluído';
        solicitacao.dataConclusao = new Date().toISOString().split('T')[0];
    }
    renderSolicitacoesRelatorios();
}

function gerarRelatorio(alunoParam, bimestreParam) {
    if (!turmaSelecionada) {
        alert('Selecione uma turma primeiro!');
        return;
    }

    const aluno = alunoParam || document.getElementById('alunoRelatorio').value;
    const bimestre = bimestreParam || document.getElementById('bimestreRelatorio').value;

    if (!aluno) {
        alert('Selecione um aluno.');
        return;
    }

    const notas = getNotasAluno(turmaSelecionada, aluno);
    const media = calcularMedia(notas);
    const presencas = db.presencas[turmaSelecionada] || [];
    const observacoes = db.observacoes[turmaSelecionada] || [];
    const obsAluno = observacoes.filter(o => o.aluno === aluno);

    let totalPresencas = 0;
    let totalDias = presencas.length;
    presencas.forEach(p => {
        if (p.presentes.includes(aluno)) totalPresencas++;
    });
    const taxaPresenca = totalDias > 0 ? (totalPresencas / totalDias * 100) : 0;

    const notasStr = `${notas[1] || 0};${notas[2] || 0};${notas[3] || 0};${notas[4] || 0}`;

    let relatorioHtml = `
        <div class="relatorio-content">
            <h4>📄 Relatório do Aluno</h4>
            <div class="info-line"><strong>Aluno:</strong> ${aluno}</div>
            <div class="info-line"><strong>Turma:</strong> ${labelTurma(turmaSelecionada)}</div>
            <div class="info-line"><strong>Professor:</strong> ${currentUser.nome}</div>
            <div class="info-line"><strong>Bimestre:</strong> ${bimestre === 'anual' ? 'Anual' : bimestre + 'º Bimestre'}</div>
            <div style="margin-top: 15px;">
                <strong>Notas:</strong><br>
                1º Bim: ${notas[1] || 0} | 2º Bim: ${notas[2] || 0} | 3º Bim: ${notas[3] || 0} | 4º Bim: ${notas[4] || 0}
                <br><strong>Média:</strong> ${media.toFixed(1)}
            </div>
            <div style="margin-top: 10px;">
                <strong>Presença:</strong> ${taxaPresenca.toFixed(1)}% (${totalPresencas}/${totalDias} dias)
            </div>
            <div style="margin-top: 10px;">
                <strong>Observações:</strong>
                ${obsAluno.length > 0 ? obsAluno.map(o => `<br>• ${o.data}: ${o.observacao} (${o.tipo})`).join('') : '<br>Nenhuma observação registrada.'}
            </div>
            ${bimestre !== 'anual' ? `
                <div style="margin-top: 10px;">
                    <strong>Desempenho no ${bimestre}º Bimestre:</strong>
                    ${notas[bimestre] >= 7 ? '✅ Bom desempenho' : notas[bimestre] >= 5 ? '⚠️ Em recuperação' : '❌ Necessita reforço'}
                </div>
            ` : ''}
            <div style="margin-top: 10px; padding: 10px; background: #ebf8ff; border-radius: 5px;">
                <strong>💡 Recomendação:</strong>
                ${media >= 7 ? 'Aluno com bom desempenho. Continuar estimulando o aprendizado.' :
                  media >= 5 ? 'Aluno em processo de recuperação. Reforçar conteúdos com atividades complementares.' :
                  'Aluno necessita de atenção especial. Recomenda-se plano de recuperação intensivo.'}
            </div>
        </div>
    `;

    document.getElementById('relatorioGerado').innerHTML = relatorioHtml;
    document.getElementById('modalRelatorioContent').innerHTML = relatorioHtml;
    document.getElementById('modalRelatorio').classList.add('active');

    db.relatoriosGerados.push({
        turma: turmaSelecionada,
        aluno: aluno,
        bimestre: bimestre,
        data: new Date().toISOString().split('T')[0],
        professor: currentUser.nome,
        notas: notasStr,
        media: media,
        presenca: taxaPresenca,
        observacoes: obsAluno.map(o => o.observacao).join('; '),
        recomendacao: media >= 7 ? 'Bom desempenho' : media >= 5 ? 'Em recuperação' : 'Necessita reforço'
    });
}

// ============================================
// PROFESSOR - SELECTS
// ============================================
function carregarAlunosSelects() {
    if (!turmaSelecionada) return;
    const alunos = getAlunosByTurma(turmaSelecionada);

    ['alunoRelatorio', 'alunoObservacao'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = alunos.map(aluno =>
                `<option value="${aluno}">${aluno}</option>`
            ).join('');
        }
    });
}

// ============================================
// COORDENADOR - VISÃO GERAL POR TURMA
// ============================================
function renderVisaoGeralTurmas() {
    const tbody = document.getElementById('visaoGeralTurmas');
    
    if (escolaData.turmas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #718096;">Nenhuma turma cadastrada</td></tr>';
        return;
    }

    tbody.innerHTML = escolaData.turmas.map(turma => {
        const alunos = getAlunosByTurma(turma);
        let somaMedias = 0;
        let totalAlunos = 0;
        let totalPresencas = 0;
        let totalDias = 0;
        
        alunos.forEach(aluno => {
            const notas = getNotasAluno(turma, aluno);
            const media = calcularMedia(notas);
            if (media > 0) {
                somaMedias += media;
                totalAlunos++;
            }
        });
        
        const mediaGeral = totalAlunos > 0 ? (somaMedias / totalAlunos) : 0;
        
        const presencas = db.presencas[turma] || [];
        presencas.forEach(p => {
            totalDias++;
            totalPresencas += p.presentes.length;
        });
        const mediaPresenca = totalDias > 0 ? (totalPresencas / (totalDias * alunos.length) * 100) : 0;
        
        const solicitacoes = db.solicitacoes.filter(s => s.turma === turma && s.status === 'Pendente');
        
        let professor = 'Não atribuído';
        for (const [profId, turmas] of Object.entries(db.atribuicoes)) {
            if (turmas.includes(turma)) {
                const prof = getProfessorById(profId);
                if (prof && prof.tipo === 'Regente') {
                    professor = prof.nome;
                    break;
                }
            }
        }
        
        return `
            <tr>
                <td><strong>${labelTurma(turma)}</strong></td>
                <td>${professor}</td>
                <td>${mediaGeral.toFixed(1)}</td>
                <td>${mediaPresenca.toFixed(1)}%</td>
                <td>${solicitacoes.length}</td>
                <td>
                    <button onclick="verDetalhesTurma('${turma}')" class="btn btn-small btn-secondary" style="padding: 4px 8px; font-size: 12px;">👁️ Ver</button>
                </td>
            </tr>
        `;
    }).join('');
}

function verDetalhesTurma(turma) {
    turmaSelecionada = turma;
    alert(`📊 Detalhes da ${labelTurma(turma)}\n\nAcesse a área de Professor para ver todos os detalhes.`);
}

// ============================================
// COORDENADOR - ATRIBUIÇÃO DE TURMAS
// ============================================
function carregarProfessoresAtribuicao() {
    const select = document.getElementById('professorSelect');
    
    select.innerHTML = '<option value="">-- Selecione --</option>';
    
    if (!escolaData.professores || escolaData.professores.length === 0) {
        select.innerHTML = '<option value="">-- Nenhum professor cadastrado --</option>';
        return;
    }
    
    escolaData.professores.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.nome} (${p.tipo})`;
        select.appendChild(option);
    });
    
    renderProfessoresAtribuidos();
}

function carregarTurmasSelect() {
    const select = document.getElementById('turmaSelect');
    select.innerHTML = '<option value="">-- Selecione --</option>' +
        escolaData.turmas.map(t =>
            `<option value="${t}">${labelTurma(t)}</option>`
        ).join('');
}

function renderProfessoresAtribuidos() {
    const container = document.getElementById('professoresAtribuidos');
    
    if (escolaData.professores.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhum professor cadastrado.</p>';
        return;
    }

    container.innerHTML = escolaData.professores.map(prof => {
        const turmas = getTurmasByProfessor(prof.id);
        return `
            <div class="professor-item">
                <strong>${prof.nome}</strong>
                <div class="especialidade">${prof.tipo}</div>
                <div class="turmas-atribuidas">
                    ${turmas.length > 0 ? turmas.map(t => 
                        `<span class="turma-tag">${labelTurma(t)}</span>`
                    ).join('') : '<span style="color: #a0aec0; font-size: 0.9em;">Nenhuma turma atribuída</span>'}
                </div>
            </div>
        `;
    }).join('');
}

function atribuirTurma() {
    const profId = document.getElementById('professorSelect').value;
    const turma = document.getElementById('turmaSelect').value;

    if (!profId || !turma) {
        alert('Selecione um professor e uma turma.');
        return;
    }

    if (!db.atribuicoes[profId]) {
        db.atribuicoes[profId] = [];
    }

    if (db.atribuicoes[profId].includes(turma)) {
        alert('Esta turma já está atribuída a este professor.');
        return;
    }

    db.atribuicoes[profId].push(turma);
    renderProfessoresAtribuidos();
    renderVisaoGeralTurmas();

    const prof = getProfessorById(profId);
    if (prof && prof.nome === currentUser.nome) {
        currentUser.turmas = getTurmasByProfessor(profId);
        renderMinhasTurmas();
    }

    alert(`✅ Turma ${labelTurma(turma)} atribuída a ${getProfessorById(profId).nome} com sucesso!`);
}

function removerTurma() {
    const profId = document.getElementById('professorSelect').value;
    const turma = document.getElementById('turmaSelect').value;

    if (!profId || !turma) {
        alert('Selecione um professor e uma turma.');
        return;
    }

    if (!db.atribuicoes[profId] || !db.atribuicoes[profId].includes(turma)) {
        alert('Esta turma não está atribuída a este professor.');
        return;
    }

    if (!confirm(`Remover a turma ${labelTurma(turma)} do professor ${getProfessorById(profId).nome}?`)) {
        return;
    }

    db.atribuicoes[profId] = db.atribuicoes[profId].filter(t => t !== turma);
    renderProfessoresAtribuidos();
    renderVisaoGeralTurmas();

    const prof = getProfessorById(profId);
    if (prof && prof.nome === currentUser.nome) {
        currentUser.turmas = getTurmasByProfessor(profId);
        renderMinhasTurmas();
    }

    alert(`✅ Turma ${labelTurma(turma)} removida de ${getProfessorById(profId).nome}.`);
}

// ============================================
// COORDENADOR - SOLICITAR RELATÓRIO
// ============================================
function carregarSolicitacaoTurmas() {
    const select = document.getElementById('solicitarTurma');
    select.innerHTML = '<option value="">-- Selecione --</option>' +
        escolaData.turmas.map(t =>
            `<option value="${t}">${labelTurma(t)}</option>`
        ).join('');
    
    document.getElementById('solicitarTurma').onchange = function() {
        const turma = this.value;
        const alunoSelect = document.getElementById('solicitarAluno');
        const alunos = turma ? getAlunosByTurma(turma) : [];
        alunoSelect.innerHTML = '<option value="">-- Selecione --</option>' +
            alunos.map(a => `<option value="${a}">${a}</option>`).join('');
    };
}

function solicitarRelatorio() {
    const turma = document.getElementById('solicitarTurma').value;
    const aluno = document.getElementById('solicitarAluno').value;
    const bimestre = document.getElementById('solicitarBimestre').value;

    if (!turma || !aluno) {
        alert('Selecione a turma e o aluno.');
        return;
    }

    const data = new Date().toISOString().split('T')[0];
    
    db.solicitacoes.push({
        turma,
        aluno,
        bimestre,
        data,
        status: 'Pendente',
        dataConclusao: '',
        observacoes: ''
    });

    renderSolicitacoes();
    alert('✅ Relatório solicitado com sucesso! O professor será notificado.');
}

function renderSolicitacoes() {
    const container = document.getElementById('listaSolicitacoes');
    
    if (db.solicitacoes.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Nenhuma solicitação de relatório.</p>';
        return;
    }

    container.innerHTML = db.solicitacoes.slice().reverse().map(s => `
        <div class="registro-item">
            <div class="data">📄 ${labelTurma(s.turma)} - ${s.aluno}</div>
            <div class="conteudo">
                ${s.bimestre === 'anual' ? 'Anual' : s.bimestre + 'º Bimestre'} - Solicitado em: ${s.data}
                <span class="status-badge ${s.status === 'Concluído' ? 'concluido' : 'pendente'}">${s.status}</span>
                ${s.status === 'Concluído' ? `<span style="font-size: 0.8em; color: #718096;">Concluído em: ${s.dataConclusao || ''}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ============================================
// DIRETORIA - STATS GERENCIAIS
// ============================================
function renderStatsGerenciais() {
    const container = document.getElementById('statsGerenciais');
    
    let totalAlunos = 0;
    let totalTurmas = escolaData.turmas.length;
    let somaMedias = 0;
    let totalComMedia = 0;
    let totalPresencas = 0;
    let totalDias = 0;
    let totalSolicitacoes = db.solicitacoes.length;
    let totalRelatorios = db.relatoriosGerados.length;
    let totalConteudos = 0;
    let totalObservacoes = 0;

    escolaData.turmas.forEach(turma => {
        const alunos = getAlunosByTurma(turma);
        totalAlunos += alunos.length;
        
        alunos.forEach(aluno => {
            const notas = getNotasAluno(turma, aluno);
            const media = calcularMedia(notas);
            if (media > 0) {
                somaMedias += media;
                totalComMedia++;
            }
        });
        
        const presencas = db.presencas[turma] || [];
        presencas.forEach(p => {
            totalDias++;
            totalPresencas += p.presentes.length;
        });

        totalConteudos += (db.conteudos[turma] || []).length;
        totalObservacoes += (db.observacoes[turma] || []).length;
    });

    const mediaGeral = totalComMedia > 0 ? (somaMedias / totalComMedia) : 0;
    const taxaPresenca = totalDias > 0 ? (totalPresencas / (totalDias * (totalAlunos / totalTurmas || 1)) * 100) : 0;
    const taxaAprovacao = mediaGeral >= 7 ? 85 : 75;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-number">${mediaGeral.toFixed(1)}</div>
            <div class="stat-label">Média Geral da Escola</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🎓</div>
            <div class="stat-number">${taxaAprovacao}%</div>
            <div class="stat-label">Taxa de Aprovação</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-number">${totalAlunos}</div>
            <div class="stat-label">Total de Alunos</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-number">${taxaPresenca.toFixed(1)}%</div>
            <div class="stat-label">Presença Média</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🏫</div>
            <div class="stat-number">${totalTurmas}</div>
            <div class="stat-label">Turmas</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-number">${totalSolicitacoes}</div>
            <div class="stat-label">Relatórios Solicitados</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-number">${totalRelatorios}</div>
            <div class="stat-label">Relatórios Gerados</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-number">${totalConteudos}</div>
            <div class="stat-label">Conteúdos Registrados</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✏️</div>
            <div class="stat-number">${totalObservacoes}</div>
            <div class="stat-label">Observações</div>
        </div>
    `;
}

// ============================================
// DIRETORIA - RELATÓRIOS CONSOLIDADOS
// ============================================
function gerarRelatorioGeral() {
    const container = document.getElementById('relatorioConsolidado');
    
    let html = `
        <div class="relatorio-content">
            <h4>📊 Relatório Geral da Escola</h4>
            <div class="info-line"><strong>Data:</strong> ${new Date().toLocaleDateString()}</div>
            <div class="info-line"><strong>Total de Turmas:</strong> ${escolaData.turmas.length}</div>
            <div class="info-line"><strong>Total de Professores:</strong> ${escolaData.professores.length}</div>
            <div class="info-line"><strong>Total de Alunos:</strong> ${Object.values(escolaData.alunos).reduce((a, b) => a + b.length, 0)}</div>
            <div style="margin-top: 15px;">
                <table>
                    <thead>
                        <tr>
                            <th>Turma</th>
                            <th>Alunos</th>
                            <th>Média</th>
                            <th>Presença</th>
                            <th>Conteúdos</th>
                            <th>Observações</th>
                            <th>Relatórios</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${escolaData.turmas.map(turma => {
                            const alunos = getAlunosByTurma(turma);
                            let somaMedias = 0;
                            let count = 0;
                            alunos.forEach(aluno => {
                                const notas = getNotasAluno(turma, aluno);
                                const media = calcularMedia(notas);
                                if (media > 0) { somaMedias += media; count++; }
                            });
                            const media = count > 0 ? somaMedias / count : 0;
                            
                            const presencas = db.presencas[turma] || [];
                            let totalPres = 0, totalDias = 0;
                            presencas.forEach(p => { totalDias++; totalPres += p.presentes.length; });
                            const taxaPres = totalDias > 0 ? (totalPres / (totalDias * alunos.length) * 100) : 0;
                            
                            const solicitacoes = db.solicitacoes.filter(s => s.turma === turma);
                            const conteudos = db.conteudos[turma] || [];
                            const observacoes = db.observacoes[turma] || [];
                            
                            return `
                                <tr>
                                    <td>${labelTurma(turma)}</td>
                                    <td>${alunos.length}</td>
                                    <td>${media.toFixed(1)}</td>
                                    <td>${taxaPres.toFixed(1)}%</td>
                                    <td>${conteudos.length}</td>
                                    <td>${observacoes.length}</td>
                                    <td>${solicitacoes.length}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function gerarRelatorioPorTurma() {
    const container = document.getElementById('relatorioConsolidado');
    
    let html = `
        <div class="relatorio-content">
            <h4>📊 Relatório por Turma</h4>
            <div style="margin-top: 15px;">
                ${escolaData.turmas.map(turma => {
                    const alunos = getAlunosByTurma(turma);
                    return `
                        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px;">
                            <h5>${labelTurma(turma)}</h5>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Aluno</th>
                                        <th>1ºB</th>
                                        <th>2ºB</th>
                                        <th>3ºB</th>
                                        <th>4ºB</th>
                                        <th>Média</th>
                                        <th>Presença</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${alunos.map(aluno => {
                                        const notas = getNotasAluno(turma, aluno);
                                        const media = calcularMedia(notas);
                                        
                                        const presencas = db.presencas[turma] || [];
                                        let totalPres = 0, totalDias = presencas.length;
                                        presencas.forEach(p => {
                                            if (p.presentes.includes(aluno)) totalPres++;
                                        });
                                        const taxaPres = totalDias > 0 ? (totalPres / totalDias * 100) : 0;
                                        
                                        return `
                                            <tr>
                                                <td>${aluno}</td>
                                                <td>${notas[1] || 0}</td>
                                                <td>${notas[2] || 0}</td>
                                                <td>${notas[3] || 0}</td>
                                                <td>${notas[4] || 0}</td>
                                                <td><strong>${media.toFixed(1)}</strong></td>
                                                <td>${taxaPres.toFixed(1)}%</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function gerarRelatorioPorProfessor() {
    const container = document.getElementById('relatorioConsolidado');
    
    let html = `
        <div class="relatorio-content">
            <h4>📊 Relatório por Professor</h4>
            <div style="margin-top: 15px;">
                ${escolaData.professores.map(prof => {
                    const turmas = getTurmasByProfessor(prof.id);
                    return `
                        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px;">
                            <h5>${prof.nome} (${prof.tipo})</h5>
                            <p style="color: #718096;">Turmas: ${turmas.length > 0 ? turmas.map(t => labelTurma(t)).join(', ') : 'Nenhuma'}</p>
                            ${turmas.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Turma</th>
                                            <th>Alunos</th>
                                            <th>Média</th>
                                            <th>Presença</th>
                                            <th>Conteúdos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${turmas.map(turma => {
                                            const alunos = getAlunosByTurma(turma);
                                            let somaMedias = 0, count = 0;
                                            alunos.forEach(aluno => {
                                                const notas = getNotasAluno(turma, aluno);
                                                const media = calcularMedia(notas);
                                                if (media > 0) { somaMedias += media; count++; }
                                            });
                                            const media = count > 0 ? somaMedias / count : 0;
                                            
                                            const presencas = db.presencas[turma] || [];
                                            let totalPres = 0, totalDias = 0;
                                            presencas.forEach(p => { totalDias++; totalPres += p.presentes.length; });
                                            const taxaPres = totalDias > 0 ? (totalPres / (totalDias * alunos.length) * 100) : 0;
                                            
                                            const conteudos = db.conteudos[turma] || [];
                                            
                                            return `
                                                <tr>
                                                    <td>${labelTurma(turma)}</td>
                                                    <td>${alunos.length}</td>
                                                    <td>${media.toFixed(1)}</td>
                                                    <td>${taxaPres.toFixed(1)}%</td>
                                                    <td>${conteudos.length}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ============================================
// DIRETORIA - RELATÓRIO INDIVIDUAL
// ============================================
function carregarTurmasDirecao() {
    const select = document.getElementById('direcaoTurma');
    select.innerHTML = '<option value="">-- Selecione --</option>' +
        escolaData.turmas.map(t =>
            `<option value="${t}">${labelTurma(t)}</option>`
        ).join('');
    
    document.getElementById('direcaoTurma').onchange = function() {
        const turma = this.value;
        const alunoSelect = document.getElementById('direcaoAluno');
        const alunos = turma ? getAlunosByTurma(turma) : [];
        alunoSelect.innerHTML = '<option value="">-- Selecione --</option>' +
            alunos.map(a => `<option value="${a}">${a}</option>`).join('');
    };
}

function visualizarRelatorioAluno() {
    const turma = document.getElementById('direcaoTurma').value;
    const aluno = document.getElementById('direcaoAluno').value;

    if (!turma || !aluno) {
        alert('Selecione a turma e o aluno.');
        return;
    }

    const notas = getNotasAluno(turma, aluno);
    const media = calcularMedia(notas);
    const presencas = db.presencas[turma] || [];
    const observacoes = db.observacoes[turma] || [];
    const obsAluno = observacoes.filter(o => o.aluno === aluno);
    const conteudos = db.conteudos[turma] || [];

    let totalPresencas = 0;
    let totalDias = presencas.length;
    presencas.forEach(p => {
        if (p.presentes.includes(aluno)) totalPresencas++;
    });
    const taxaPresenca = totalDias > 0 ? (totalPresencas / totalDias * 100) : 0;

    const relatorioHtml = `
        <div class="relatorio-content">
            <h4>📄 Relatório Completo do Aluno</h4>
            <div class="info-line"><strong>Aluno:</strong> ${aluno}</div>
            <div class="info-line"><strong>Turma:</strong> ${labelTurma(turma)}</div>
            <div class="info-line"><strong>Data:</strong> ${new Date().toLocaleDateString()}</div>
            <div style="margin-top: 15px;">
                <strong>Notas Bimestrais:</strong><br>
                1º Bim: <strong>${notas[1] || 0}</strong> | 
                2º Bim: <strong>${notas[2] || 0}</strong> | 
                3º Bim: <strong>${notas[3] || 0}</strong> | 
                4º Bim: <strong>${notas[4] || 0}</strong>
                <br><strong>Média Final:</strong> ${media.toFixed(1)}
                <br><strong>Status:</strong> ${media >= 7 ? '✅ Aprovado' : media >= 5 ? '⚠️ Recuperação' : '❌ Reprovado'}
            </div>
            <div style="margin-top: 10px;">
                <strong>Frequência:</strong> ${taxaPresenca.toFixed(1)}% (${totalPresencas}/${totalDias} dias)
            </div>
            <div style="margin-top: 10px;">
                <strong>Conteúdos Trabalhados:</strong>
                ${conteudos.length > 0 ? conteudos.slice(-5).map(c => 
                    `<br>• ${c.data} - ${c.disciplina}: ${c.conteudo}`
                ).join('') : '<br>Nenhum conteúdo registrado.'}
            </div>
            <div style="margin-top: 10px;">
                <strong>Observações:</strong>
                ${obsAluno.length > 0 ? obsAluno.map(o => 
                    `<br>• ${o.data}: ${o.observacao} (${o.tipo})`
                ).join('') : '<br>Nenhuma observação registrada.'}
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #ebf8ff; border-radius: 5px;">
                <strong>💡 Recomendação Pedagógica:</strong>
                ${media >= 7 ? 'Aluno com bom desempenho. Continuar estimulando o aprendizado.' :
                  media >= 5 ? 'Aluno em processo de recuperação. Reforçar conteúdos com atividades complementares.' :
                  'Aluno necessita de atenção especial. Recomenda-se plano de recuperação intensivo.'}
            </div>
        </div>
    `;

    document.getElementById('relatorioAlunoCompleto').innerHTML = relatorioHtml;
    document.getElementById('modalRelatorioContent').innerHTML = relatorioHtml;
    document.getElementById('modalRelatorio').classList.add('active');
}

// ============================================
// TABS
// ============================================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`)?.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    if (tab === 'presencas' && turmaSelecionada) {
        carregarPresenca();
    }
    if (tab === 'conteudos' && turmaSelecionada) {
        carregarConteudos();
    }
    if (tab === 'observacoes' && turmaSelecionada) {
        carregarObservacoes();
    }
    if (tab === 'relatorios' && turmaSelecionada) {
        carregarRelatorios();
    }
    if (tab === 'notas' && turmaSelecionada) {
        carregarTabelaNotas();
    }
}

// ============================================
// MODAL
// ============================================
function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ============================================
// LOGOUT
// ============================================
function logout() {
    usuarioLogado = null;
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').classList.remove('show');
    document.getElementById('cardsContainer').innerHTML = '';
    document.getElementById('turmasContainer').innerHTML = '';
    turmaSelecionada = null;
    currentUser = { cargo: '', nome: '', turmas: [] };
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataPresenca').value = hoje;
    document.getElementById('dataObservacao').value = hoje;
    document.getElementById('dataConteudo').value = hoje;

    ['dataPresenca', 'dataObservacao', 'dataConteudo'].forEach(id => {
        document.getElementById(id).max = hoje;
    });

    console.log('🚀 Sistema iniciado!');
    console.log('📊 Configuração:', SHEET_CONFIG);
    console.log('📋 Abas configuradas:', Object.keys(SHEET_CONFIG.abas));

    // Carrega os dados da planilha em background para agilizar o login
    setTimeout(() => {
        carregarDadosPlanilha();
    }, 300);
});