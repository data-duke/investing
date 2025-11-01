import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePortfolio } from "@/hooks/usePortfolio";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
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
              title: "Investment saved!",
              description: "Your investment has been added to your portfolio.",
            });
            
            // Navigate with the new investment ID for highlighting
            navigate(`/dashboard?newId=${result.data.id}`);
          }
        });
      } else {
        navigate("/");
      }
    }
  }, [user, navigate, addInvestment, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      navigate("/");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to your portfolio tracker</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/signup")}
              >
                Sign up
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
