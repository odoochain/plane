# Generated by Django 4.2.11 on 2024-06-03 17:16

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0066_account_id_token_cycle_logo_props_module_logo_props'),
    ]

    operations = [
        migrations.AlterField(
            model_name='account',
            name='provider',
            field=models.CharField(choices=[('google', 'Google'), ('github', 'Github'), ('gitlab', 'GitLab')]),
        ),
        migrations.AlterField(
            model_name='socialloginconnection',
            name='medium',
            field=models.CharField(choices=[('Google', 'google'), ('Github', 'github'), ('GitLab', 'gitlab'), ('Jira', 'jira')], default=None, max_length=20),
        ),
    ]