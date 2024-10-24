import {v4 as uuid} from "uuid";

export type HelpRequestData = {
    id: string;
    title: string;
    organization: {
        title: string;
        isVerified?: boolean;
    },
    description: string;
    goalDescription: string;
    actionsSchedule: Array<{
        stepLabel: string;
        isDone?: boolean;
    }>;
    endingDate: string;
    location: {
        latitude: number;
        longitude: number;
        title: string;
    },
    contacts: {
        email: string;
        phone?: string;
        social: {
            telegram?: string;
            whatsapp?: string;
            vk?: string;
        }
    }
}
export const generateHelpRequests = (count: number): HelpRequestData[] => {
    const result = [];
    for(let i = 0; i < count; i++) {
        const requestData: HelpRequestData = {
            id: uuid(),
            title: `Help Request ${i}`,
            organization: {
                title: "Добрые люди",
                isVerified: true,
            },
            description: "Очень хороший запрос. Помогаем добрым людям справиться со сложной ситуацией",
            goalDescription: 'Надо собрать денежков достаточно, чтобы помочь хорошему человеку',
            actionsSchedule: [
                {stepLabel: "Нужное купить", isDone: false},
                {stepLabel: "Денежку собрать"},
                {stepLabel: "Собраться", isDone: true}
            ],
            endingDate: "20.03.2025",
            location: {
                    latitude: 55.751244,
                    longitude: 37.618423,
                    title: 'Moscow',
            },
            contacts: {
                email: 'test@test.com',
                phone: '+1234567890',
                social: {
                    telegram: '@test',
                    whatsapp: '@test',
                    vk: 'test@test.com',
                }
            }
        }
        result.push(requestData);
    }
    return result;
}


export class HelpRequestRepository {
    private requests: Record<string, HelpRequestData> = {};
    constructor() {
        const initialRequests = generateHelpRequests(2400);
        initialRequests.forEach((requestData: HelpRequestData) => {
            this.requests[requestData.id] = requestData;
        })
    }

    public getRequests() {
        return Object.values(this.requests);
    }

    public getRequestDetails(requestId: string): HelpRequestData | null {
        return this.requests[requestId] || null;
    }

    public checkIsRequestExist(requestId: string): boolean {
        return !!this.requests[requestId];
    }
}