import { Injectable, Logger } from '@nestjs/common'; 

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name); 
    this.logger.log('Ejecutando getHello'); 
    const response = 'Hello World!';
    this.logger.log('getHello ejecutado con exito'); 
    return response;
  }
}
