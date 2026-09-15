import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401});
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {global:{headers:{Authorization:auth}}}
    );
    const {data:{user}} = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401});

    const {code} = await req.json();
    if (!code) return new Response(JSON.stringify({error:"Code is required"}),{status:400});

    const {data:member,error:me}=await supabase.from("members").select("*").eq("auth_user_id",user.id).single();
    if(me||!member) return new Response(JSON.stringify({error:"Member not found"}),{status:404});
    if(member.status!=="approved"||member.is_restricted) return new Response(JSON.stringify({error:"Account cannot redeem codes"}),{status:403});

    const {data:result,error}=await supabase.rpc("redeem_maintenance_code",{p_code:code,p_member_id:member.id});
    if(error) return new Response(JSON.stringify({error:error.message}),{status:400});
    return new Response(JSON.stringify(result),{headers:{"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500});
  }
});