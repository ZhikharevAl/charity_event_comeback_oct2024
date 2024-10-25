import {v4 as uuid} from 'uuid';
import {HelpRequestRepository} from "../HelpRequest";

export type UserData = {
    id: string;
    name: string;
    lastName: string;
    birthdate: string; // Date
    baseLocations: Array<{
        latitude: number;
        longitude: number;
        title: string;
    }>,
    educations: Array<{
       organizationName: string;
       level: 'Среднее общее' | 'Среднее профессиональное' | 'Высшее';
       specialization: string;
       graduationYear: number;
    }>,
    additionalInfo: string;
    contacts: {
        email: string;
        phone?: string;
        social: {
            telegram?: string;
            whatsapp?: string;
            vk?: string;
        }
    }
    favouriteRequests: string[]; // request ids
}

export const generateUsers = (count: number): UserData[] => {
    const result = [];
    for(let i = 0; i < count; i++) {
        const userData: UserData = {
            id: uuid(),
            name: `User ${i}`,
            lastName: `UserLastName ${i}`,
            birthdate: `${i % 28}.${i % 12}.19${100 - i % 23}`,
            baseLocations: [
                {
                    latitude: 55.751244,
                    longitude: 37.618423,
                    title: 'Moscow',
                }
            ],
            educations: [
                {
                    organizationName: "МОУ СОШ №" + (i % 26),
                    level: 'Среднее общее',
                    specialization: '',
                    graduationYear: 2005,
                }
            ],
            additionalInfo: 'Очень хороший человек. Добрый6 отзывчивый, честный и замечательный',
            contacts: {
                email: 'test@test.com',
                phone: '+1234567890',
                social: {
                    telegram: '@test',
                    whatsapp: '@test',
                    vk: 'test@test.com',
                }
            },
            favouriteRequests: [],
        }
        result.push(userData);
    }
    return result;
}

export class UserRepository {
    private users: Record<string, UserData> = {};
    constructor(
        private readonly requestRepository: HelpRequestRepository,
    ) {
        const initialUsers = generateUsers(24);
        initialUsers.forEach((user) => {
            this.users[user.id] = user;
        })
    }

    public getUserById(id: string): UserData | null {
        return this.users[id] || null;
    }

    public getUserFavourites(id: string): string[] {
        return this.users[id]?.favouriteRequests || [];
    }

    public addRequestToFavourites(requestId: string, userId: string): void {
        if (!this.users[userId]) {
            throw new Error("No user with id " + userId);
        }
        if (!this.requestRepository.checkIsRequestExist(requestId)) {
            throw new Error("No request with id " + requestId);
        }
        this.users[userId].favouriteRequests.push(requestId);
    }

    public removeRequestFromFavourites(requestId: string, userId: string): void {
        if (this.users[userId] && this.users[userId].favouriteRequests?.length && this.users[userId].favouriteRequests.includes(requestId)) {
            this.users[userId].favouriteRequests = this.users[userId].favouriteRequests.filter(id => id !== requestId);
        }
    }

    public getUsers() {
        return Object.values(this.users);
    }
}