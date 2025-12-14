import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePortfolio } from "@/hooks/usePortfolio";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const SignUp = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, user } = useAuth();
  const { addInvestment } = usePortfolio();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Check if there's a pending investment to process
      const pendingInvestmentStr = sessionStorage.getItem('pendingInvestment');
      if (pendingInvestmentStr) {
        const pendingInvestment = JSON.parse(pendingInvestmentStr);
        
        // Add the investment with auto-generated tag
        const autoTag = new Date(pendingInvestment.purchase_date).toISOString().split('T')[0];
        
        addInvestment({
          symbol: pendingInvestment.symbol,
          name: pendingInvestment.name,
          country: pendingInvestment.country,
          quantity: pendingInvestment.quantity,
          original_price_eur: pendingInvestment.originalPrice,
          original_investment_eur: pendingInvestment.originallyInvested,
          purchase_date: pendingInvestment.purchase_date,
          tag: pendingInvestment.tag || undefined,
          auto_tag_date: pendingInvestment.tag ? undefined : autoTag,
        }).then((result) => {
          if (!result.error && result.data) {
            // Clear the pending investment
            sessionStorage.removeItem('pendingInvestment');
            
            toast({
              title: t('toast.investmentSaved'),
              description: t('toast.investmentAddedToPortfolio'),
            });
            
            // Navigate with the new investment ID for highlighting
            navigate(`/dashboard?newId=${result.data.id}`);
          }
        });
      } else {
        navigate("/");
      }
    }
  }, [user, navigate, addInvestment, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 255) {
      toast({
        variant: "destructive",
        title: t('auth.invalidEmail'),
        description: t('auth.invalidEmailDesc'),
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t('auth.passwordsDontMatch'),
        description: t('auth.passwordsDontMatchDesc'),
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: t('auth.passwordTooShort'),
        description: t('auth.passwordTooShortDesc'),
      });
      return;
    }

    if (password.length > 72) {
      toast({
        variant: "destructive",
        title: t('auth.passwordTooLong'),
        description: t('auth.passwordTooLongDesc'),
      });
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      toast({
        variant: "destructive",
        title: t('auth.weakPassword'),
        description: t('auth.weakPasswordDesc'),
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(trimmedEmail, password);

    if (error) {
      toast({
        variant: "destructive",
        title: t('auth.signUpFailed'),
        description: error.message,
      });
    } else {
      toast({
        title: t('auth.accountCreated'),
        description: t('auth.welcomeToTracker'),
      });
      navigate("/");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.createAccount')}</CardTitle>
          <CardDescription>{t('auth.signUpDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.creatingAccount') : t('auth.signUp')}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {t('auth.hasAccount')}{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/login")}
              >
                {t('auth.signIn')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;
