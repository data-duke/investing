import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalculatorChatOrb } from "@/components/CalculatorChatOrb";
import { FeatureComparisonBanner } from "@/components/FeatureComparisonBanner";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Index = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div 
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" 
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] animate-pulse" 
          style={{ animationDelay: "2s" }} 
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] animate-pulse" 
          style={{ animationDelay: "1s" }} 
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('home.title')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {user ? (
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  {t('nav.goToPortfolio')}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                    {t('nav.login')}
                  </Button>
                  <Button onClick={() => navigate('/signup')}>
                    {t('nav.signup')}
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Hero */}
          <div className="text-center mb-10 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">
              {t('chatCalculator.heroTitle')}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              {t('chatCalculator.heroSubtitle')}
            </p>
          </div>

          {/* Chat Orb */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CalculatorChatOrb />
          </div>
        </div>

        {/* Feature Comparison - for non-logged users */}
        {!user && (
          <div className="container mx-auto px-4 py-12 max-w-5xl">
            <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <h3 className="text-2xl font-bold text-center mb-6">{t('comparison.title')}</h3>
              <FeatureComparisonBanner onSignUp={() => navigate('/signup')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
