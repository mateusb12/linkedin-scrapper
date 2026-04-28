export type RejectionEmail = {
    id: number
    threadId: string
    jobUrn?: string
    company?: string
    jobTitle?: string
    jobDescription?: string
    competition?: number
    folder: "Job fails"
    category: "rejection"
    sender: string
    senderEmail: string
    recipient: string
    subject: string
    snippet: string
    bodyText: string
    receivedAt: string
    createdAt: string
    isRead: boolean
}

export type FetchRejectionEmailsParams = {
    page: number
    limit: number
    searchTerm?: string
}

export type FetchRejectionEmailsResult = {
    data: RejectionEmail[]
    total: number
    page: number
    totalPages: number
}

function wait(ms: number) {
    return new Promise(resolve => {
        window.setTimeout(resolve, ms)
    })
}

function isoDaysAgo(days: number, hour: number, minute: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    date.setHours(hour, minute, 0, 0)

    return date.toISOString()
}

const rejectionEmails: RejectionEmail[] = [
    {
        id: 144,
        threadId: "thread-144",
        company: "Clarke Energia",
        jobTitle: "Pessoa Desenvolvedora Full Stack - Pleno (Remoto)",
        competition: 545,
        jobDescription:
            "Pessoa Desenvolvedora Full Stack - Pleno (Remoto). Responsabilidades: contribuir para o amadurecimento e manutencao da infraestrutura em Kubernetes; colaborar com o desenvolvimento tecnico de desenvolvedores juniores; implementar layouts desenvolvidos pelo time de Design; atuar na execucao de novos projetos com definicao de arquitetura, modelagem de banco de dados e criacao de APIs.",
        folder: "Job fails",
        category: "rejection",
        sender: "Clarke Energia Trial",
        senderEmail: "clarkeenergiatrial@ses-mail.inhire.app",
        recipient: "mateus@example.com",
        subject: "Vaga Finalizada - Pessoa Desenvolvedora Full Stack - Pleno (Remoto)",
        snippet:
            "Ola, Mateus! Gostariamos de informar que a vaga Pessoa Desenvolvedora Full Stack foi finalizada.",
        bodyText:
            "Ola, Mateus!\n\nTudo bem?\n\nGostariamos de informar que a vaga Pessoa Desenvolvedora Full Stack - Pleno foi finalizada. Agradecemos sua participacao no processo seletivo e o tempo dedicado ate aqui.\n\nDesejamos sucesso nos proximos passos.",
        receivedAt: isoDaysAgo(1, 20, 11),
        createdAt: isoDaysAgo(1, 20, 12),
        isRead: true,
    },
    {
        id: 145,
        threadId: "thread-145",
        jobUrn: "4393208855",
        folder: "Job fails",
        category: "rejection",
        sender: "Pulsus",
        senderEmail: "no-reply@gupy.com.br",
        recipient: "mateus@example.com",
        subject: "Agradecemos seu interesse na vaga - Pulsus",
        snippet:
            "Agradecemos seu interesse em fazer parte da Pulsus. Neste momento seguimos com outros candidatos.",
        bodyText:
            "Ola, Mateus.\n\nAgradecemos seu interesse em fazer parte da Pulsus e por dedicar seu tempo ao nosso processo seletivo.\n\nNeste momento, seguimos com outros candidatos que estao mais alinhados aos requisitos da oportunidade.\n\nSeu cadastro permanecera em nossa base para futuras vagas.",
        receivedAt: isoDaysAgo(1, 13, 46),
        createdAt: isoDaysAgo(1, 13, 47),
        isRead: true,
    },
    {
        id: 147,
        threadId: "thread-147",
        folder: "Job fails",
        category: "rejection",
        sender: "Rock Encantech",
        senderEmail: "rockencantech@ses-mail.inhire.app",
        recipient: "mateus@example.com",
        subject: "Sobre sua inscricao na Rock Encantech",
        snippet:
            "Queremos te agradecer por ter participado do nosso processo seletivo. Neste momento nao seguiremos.",
        bodyText:
            "Ola, Mateus!\n\nQueremos te agradecer por ter participado do nosso processo seletivo e por compartilhar sua trajetoria conosco.\n\nDepois de avaliarmos as candidaturas, optamos por seguir com outros perfis neste momento.\n\nSeguimos torcendo pelo seu sucesso.",
        receivedAt: isoDaysAgo(10, 15, 21),
        createdAt: isoDaysAgo(10, 15, 22),
        isRead: true,
    },
    {
        id: 148,
        threadId: "thread-148",
        jobUrn: "4385760020",
        company: "CodiLime",
        jobTitle: "Junior/Mid Full Stack Developer",
        jobDescription:
            "Junior/Mid Full Stack role focused on full stack product development, collaboration with engineering teams, frontend implementation, backend APIs and pragmatic delivery in a remote international environment.",
        folder: "Job fails",
        category: "rejection",
        sender: "Oksana Dynia - CodiLime",
        senderEmail: "oksana.dynia@codilime.teamtailor-mail.com",
        recipient: "mateus@example.com",
        subject: "Thank you for your job application!",
        snippet:
            "We greatly appreciate your interest in CodiLime and the time you invested to apply.",
        bodyText:
            "Hello Mateus,\n\nWe greatly appreciate your interest in CodiLime and the time you invested to apply for the Junior/Mid Full Stack role.\n\nAfter reviewing your application, we decided not to move forward at this stage.\n\nThank you again and best of luck in your search.",
        receivedAt: isoDaysAgo(16, 16, 11),
        createdAt: isoDaysAgo(16, 16, 12),
        isRead: true,
    },
    {
        id: 149,
        threadId: "thread-149",
        jobUrn: "4390172600",
        company: "LaTeam Partners",
        jobTitle: "Python Developer - Odoo",
        jobDescription:
            "Python Developer - Odoo role. Expected experience with Python, Odoo customization, backend development, business workflows, integrations, SQL databases and maintenance of ERP modules.",
        folder: "Job fails",
        category: "rejection",
        sender: "LinkedIn",
        senderEmail: "jobs-noreply@linkedin.com",
        recipient: "mateus@example.com",
        subject: "Your application to Python Developer - Odoo at LaTeam Partners",
        snippet:
            "Your update from LaTeam Partners. Your application was viewed and the company moved forward.",
        bodyText:
            "Your update from LaTeam Partners\n\nThis email was intended for Mateus Bessa.\n\nLaTeam Partners has moved forward with other candidates for Python Developer - Odoo. You can continue tracking new opportunities on LinkedIn Jobs.",
        receivedAt: isoDaysAgo(21, 13, 8),
        createdAt: isoDaysAgo(21, 13, 9),
        isRead: true,
    },
    {
        id: 150,
        threadId: "thread-150",
        company: "Ayesa Digital",
        jobTitle: "Back-end Senior Python",
        jobDescription:
            "Back-end Senior Python role focused on backend services, APIs, system integrations, clean code, production support and senior ownership of Python services.",
        folder: "Job fails",
        category: "rejection",
        sender: "LinkedIn",
        senderEmail: "jobs-noreply@linkedin.com",
        recipient: "mateus@example.com",
        subject: "Your application to Back-end Senior Python at Ayesa Digital",
        snippet:
            "Your update from Ayesa Digital. The company is no longer considering your application.",
        bodyText:
            "Your update from Ayesa Digital\n\nAyesa Digital has closed your application for Back-end Senior Python. Keep applying to similar roles and checking new job recommendations.",
        receivedAt: isoDaysAgo(22, 16, 16),
        createdAt: isoDaysAgo(22, 16, 17),
        isRead: true,
    },
    {
        id: 151,
        threadId: "thread-151",
        company: "OnHires",
        jobTitle: "Python Scraping Developer",
        jobDescription:
            "Python Scraping Developer position. Requirements include Python scraping, data extraction pipelines, browser automation, API integrations, resilient parsers, proxy/session handling and careful debugging of data quality issues.",
        folder: "Job fails",
        category: "rejection",
        sender: "OnHires Hiring Team",
        senderEmail: "no-reply@ashbyhq.com",
        recipient: "mateus@example.com",
        subject: "Thank you for applying for the role with OnHires",
        snippet:
            "We appreciate your interest and the time invested to apply for Python Scraping Developer.",
        bodyText:
            "Hi Mateus,\n\nWe appreciate your interest and the time you invested to apply for the Python Scraping Developer position.\n\nAfter careful review, we will not be moving forward with your application for this role.\n\nBest regards,\nOnHires Hiring Team",
        receivedAt: isoDaysAgo(24, 11, 20),
        createdAt: isoDaysAgo(24, 11, 21),
        isRead: false,
    },
    {
        id: 152,
        threadId: "thread-152",
        jobUrn: "4383173301",
        company: "ProFUSION",
        jobTitle: "Desenvolvedor de Software",
        jobDescription:
            "Desenvolvedor de Software com atuacao em desenvolvimento de sistemas, manutencao de funcionalidades, integracoes, boas praticas de codigo, colaboracao com time tecnico e entrega de solucoes para produto.",
        folder: "Job fails",
        category: "rejection",
        sender: "ProFUSION",
        senderEmail: "hrbot@profusion.mobi",
        recipient: "mateus@example.com",
        subject: "Processo Seletivo ProFUSION - Agradecimento por aplicacao",
        snippet:
            "Recebemos sua inscricao para Desenvolvedor de Software e agradecemos o interesse.",
        bodyText:
            "Ola Mateus Bessa Mauricio,\n\nRecebemos sua inscricao para a vaga de Desenvolvedor de Software. Agradecemos o interesse em fazer parte da ProFUSION.\n\nNeste momento, optamos por seguir com outro perfil.\n\nObrigado pela participacao.",
        receivedAt: isoDaysAgo(36, 2, 33),
        createdAt: isoDaysAgo(36, 2, 34),
        isRead: true,
    },
    {
        id: 153,
        threadId: "thread-153",
        company: "Mercor x AI Labs",
        jobTitle: "Python Developer",
        jobDescription:
            "Python Developer opportunity for AI Labs. Expected backend Python skills, remote collaboration, problem solving, data-oriented workflows, API integrations and reliable delivery for AI-related products.",
        folder: "Job fails",
        category: "rejection",
        sender: "Crossing Hurdles",
        senderEmail: "notifications@ceipalmail.com",
        recipient: "mateus@example.com",
        subject: "Python Developer | Remote | Mercor x AI Labs",
        snippet:
            "Thank you for your application. The client has decided to proceed with other candidates.",
        bodyText:
            "Hello Mateus,\n\nThank you for your application to the Python Developer opportunity. The client reviewed your profile and decided to proceed with other candidates for this opening.\n\nWe will keep your profile available for future opportunities.",
        receivedAt: isoDaysAgo(38, 20, 21),
        createdAt: isoDaysAgo(38, 20, 22),
        isRead: false,
    },
    {
        id: 158,
        threadId: "thread-158",
        folder: "Job fails",
        category: "rejection",
        sender: "Petlove",
        senderEmail: "noreply@job.recrut.ai",
        recipient: "mateus@example.com",
        subject: "[PETLOVE] Retorno sobre a oportunidade",
        snippet:
            "Agradecemos seu interesse. Nesse momento, voce nao seguira para as proximas etapas.",
        bodyText:
            "Mateus Bessa Mauricio,\n\nAgradecemos seu interesse em se candidatar em nossa oportunidade.\n\nNesse momento, voce nao seguira para as proximas etapas do processo seletivo. Seguimos com seu cadastro para futuras oportunidades.",
        receivedAt: isoDaysAgo(42, 20, 43),
        createdAt: isoDaysAgo(42, 20, 44),
        isRead: true,
    },
    {
        id: 159,
        threadId: "thread-159",
        folder: "Job fails",
        category: "rejection",
        sender: "Grupo 3Coracoes",
        senderEmail: "no-reply@gupy.com.br",
        recipient: "mateus@example.com",
        subject: "Obrigada pelo interesse em fazer parte da maior empresa de cafe do Brasil.",
        snippet:
            "Agradecemos sua participacao no processo. No momento, seguimos com outro candidato.",
        bodyText:
            "Ola, Mateus.\n\nObrigada pelo interesse em fazer parte do Grupo 3Coracoes. Avaliamos seu perfil com cuidado e, neste momento, seguimos com outro candidato.\n\nDesejamos sucesso em sua trajetoria.",
        receivedAt: isoDaysAgo(42, 19, 44),
        createdAt: isoDaysAgo(42, 19, 45),
        isRead: true,
    },
    {
        id: 161,
        threadId: "thread-161",
        jobUrn: "4374832924",
        folder: "Job fails",
        category: "rejection",
        sender: "DB",
        senderEmail: "no-reply@gupy.com.br",
        recipient: "mateus@example.com",
        subject: "DB | Retorno processo seletivo",
        snippet:
            "No readable content, but this message was imported from the Job fails Gmail label.",
        bodyText:
            "Ola, Mateus.\n\nEste retorno foi importado do marcador Job fails. O corpo original nao tinha conteudo legivel no processamento local, mas foi classificado como retorno negativo do processo seletivo.",
        receivedAt: isoDaysAgo(42, 14, 31),
        createdAt: isoDaysAgo(42, 14, 32),
        isRead: true,
    },
]

export async function fetchRejectionEmails({
    page,
    limit,
    searchTerm = "",
}: FetchRejectionEmailsParams): Promise<FetchRejectionEmailsResult> {
    await wait(300)

    const normalizedSearch = searchTerm.trim().toLowerCase()
    const filteredEmails = normalizedSearch
        ? rejectionEmails.filter(email =>
              [
                  email.sender,
                  email.senderEmail,
                  email.subject,
                  email.snippet,
                  email.bodyText,
                  email.company ?? "",
                  email.jobTitle ?? "",
                  email.jobDescription ?? "",
              ].some(value => value.toLowerCase().includes(normalizedSearch)),
          )
        : rejectionEmails

    const sortedEmails = [...filteredEmails].sort(
        (a, b) =>
            new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    )
    const total = sortedEmails.length
    const totalPages = Math.max(Math.ceil(total / limit), 1)
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * limit

    return {
        data: sortedEmails.slice(start, start + limit),
        total,
        page: safePage,
        totalPages,
    }
}

export async function syncRejectionEmails(): Promise<{newCount: number}> {
    await wait(700)

    return {newCount: 0}
}
