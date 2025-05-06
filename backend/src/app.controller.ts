import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    this.logger.log('Petición recibida en getHello');
    const response = this.appService.getHello();
    this.logger.log('Respondiendo a la petición getHello');
    return response;
  }
}
