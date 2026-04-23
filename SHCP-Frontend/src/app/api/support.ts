import { apiClient, unwrap } from './client';

export interface SubmitTicketRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'URGENT';
}

export interface TicketDto {
  ticketId: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
}

export const supportApi = {
  submitTicket: (req: SubmitTicketRequest) =>
    apiClient.post('/support/tickets', req).then(unwrap<TicketDto>),
};
