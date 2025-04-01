@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe())
  async register(@Body() userData: RegisterDto) {
    return this.authService.register(userData);
  }
}
