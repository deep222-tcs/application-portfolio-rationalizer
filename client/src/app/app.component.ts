import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AgentResult, Assessment, Domain, PortfolioRecord } from "./models";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly view = signal<"assessment"|"portfolio"|"model">("assessment");
  readonly activeDomain = signal<Domain>("business");
  readonly status = signal("Ready");
  readonly result = signal<AgentResult | null>(null);
  readonly portfolio = signal<PortfolioRecord[]>([]);
  readonly domains: {key: Domain; label: string; weight: number; questions: string[]}[] = [
    {key:"business",label:"Business",weight:40,questions:["Business process criticality","Revenue or customer impact","Strategic alignment","Differentiation and competitive value","Regulatory or contractual importance"]},
    {key:"technology",label:"Technology",weight:35,questions:["Architecture fitness","Security and compliance posture","Maintainability and skills availability","Integration and data quality","Cloud and automation readiness"]},
    {key:"operations",label:"Operations",weight:25,questions:["Availability and resilience","Support effort and incident rate","Cost efficiency","Recovery and replay capability","Vendor and lifecycle risk"]},
  ];
  assessment: Assessment = {
    clientName:"Northstar Bank",clientIndustry:"Financial Services",applicationName:"Payments Hub",owner:"Core Banking",
    scores:{business:[6,7,6,5,7],technology:[4,5,4,6,5],operations:[5,4,5,4,6]},
  };
  readonly currentDomain = computed(() => this.domains.find(d => d.key === this.activeDomain())!);
  readonly portfolioCounts = computed(() => ["Tolerate","Invest","Migrate","Eliminate"].map(name => ({name,value:this.portfolio().filter(a=>a.recommendation===name).length})));
  readonly pieStyle = computed(() => {
    const counts=this.portfolioCounts();const total=counts.reduce((s,x)=>s+x.value,0)||1;const colors=["#f59e0b","#22c55e","#3b82f6","#ef4444"];let at=0;
    return `conic-gradient(${counts.map((x,i)=>{const start=at;at+=x.value/total*360;return `${colors[i]} ${start}deg ${at}deg`}).join(",")})`;
  });

  ngOnInit(){ this.loadPortfolio(); this.analyze(); }
  setView(value:"assessment"|"portfolio"|"model"){this.view.set(value)}
  selectDomain(domain:Domain){this.activeDomain.set(domain)}
  setScore(index:number,value:number){this.assessment.scores[this.activeDomain()][index]=value;this.analyze()}
  domainAverage(domain:Domain){const values=this.assessment.scores[domain];return values.reduce((a,b)=>a+b,0)/values.length}
  analyze(){
    this.status.set("LangGraph analysing…");
    this.http.post<AgentResult>("/api/agent/analyze",this.assessment).subscribe({
      next:value=>{this.result.set(value);this.status.set("Analysis complete")},
      error:()=>this.status.set("Agent unavailable"),
    });
  }
  save(){
    this.status.set("Saving assessment…");
    this.http.post<AgentResult>("/api/assessments",this.assessment).subscribe({
      next:value=>{this.result.set(value);this.status.set("Saved to PostgreSQL");this.loadPortfolio()},
      error:()=>this.status.set("Save failed"),
    });
  }
  loadPortfolio(){
    this.http.get<{applications:PortfolioRecord[]}>("/api/portfolio").subscribe({
      next:value=>this.portfolio.set(value.applications),error:()=>this.status.set("Portfolio unavailable"),
    });
  }
  radarPoints(){
    const r=this.result();const values=r?[r.averages.business,r.averages.technology,r.averages.operations]:[5,5,5];
    const center=120,radius=90;
    return values.map((v,i)=>{const angle=-Math.PI/2+i*2*Math.PI/3;const scaled=radius*v/10;return `${center+Math.cos(angle)*scaled},${center+Math.sin(angle)*scaled}`}).join(" ");
  }
}
