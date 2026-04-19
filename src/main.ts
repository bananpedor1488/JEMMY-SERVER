import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
  
  console.log('\n🚀 Jemmy Server запущен!');
  console.log(`📡 HTTP: http://localhost:${process.env.PORT || 3000}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${process.env.PORT || 3000}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Atlas подключен' : 'localhost'}`);
  console.log(`⏰ Identity Rotation: каждые 10 минут\n`);
}
bootstrap();
